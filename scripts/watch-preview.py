"""Discover local student web submissions and refresh the ProjectHub preview."""

import argparse
from contextlib import contextmanager
import fcntl
from hashlib import sha256
from html.parser import HTMLParser
import json
import math
import os
from pathlib import Path, PurePosixPath
import re
import shutil
import stat
import subprocess
import tempfile
import time
from zipfile import BadZipFile, ZipFile

PROJECT = Path(__file__).resolve().parents[1]
SUBMISSIONS = PROJECT.parent
PREVIEWS = PROJECT / 'preview-projects'
STATE = PROJECT / '.data' / 'preview'
EXISTING = {
    PROJECT.name, 'Ariho Ryan Asiimwe Project', 'Darlene  Mich Project.zip',
    'Elata Eku Dolo Project', 'Elizabeth Tamali Nelima.zip',
    'Isaac  Nsibambi Project.zip', 'Joel  Sherezo Project',
    "Joshua Ndikuwera's Project.zip", 'Julie Veronica Serugo Project',
}
HTML = {'.html', '.htm'}
WEB = HTML | {'.css', '.js', '.mjs', '.json', '.txt', '.webmanifest', '.wasm',
              '.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif',
              '.ico', '.woff', '.woff2', '.ttf', '.otf', '.mp3', '.ogg',
              '.wav', '.mp4', '.webm', '.vtt'}
MAX_SIZE = 100 * 1024 * 1024
MAX_FILES = 2000


class Title(HTMLParser):
    def __init__(self):
        super().__init__()
        self.inside = False
        self.text = []

    def handle_starttag(self, tag, attrs):
        if tag == 'title':
            self.inside = True

    def handle_endtag(self, tag):
        if tag == 'title':
            self.inside = False

    def handle_data(self, data):
        if self.inside:
            self.text.append(data)


@contextmanager
def watcher_lock():
    STATE.mkdir(parents=True, exist_ok=True)
    with (STATE / 'watcher.lock').open('a') as lock:
        try:
            fcntl.flock(lock, fcntl.LOCK_EX | fcntl.LOCK_NB)
        except BlockingIOError:
            raise SystemExit('ProjectHub preview watcher is already running.') from None
        yield


def supported(relative):
    return (relative.suffix.lower() in WEB
            and not relative.is_absolute()
            and all(not part.startswith('.') and part != '__MACOSX' for part in relative.parts)
            and '\\' not in str(relative)
            and ':' not in str(relative))


def directory_files(path):
    for folder, dirs, files in os.walk(path):
        parent = Path(folder)
        dirs[:] = sorted(name for name in dirs
                         if not name.startswith('.') and name not in {'node_modules', '__MACOSX'}
                         and not (parent / name).is_symlink())
        for name in sorted(files):
            item = parent / name
            if supported(item.relative_to(path)):
                yield item


def signature(info):
    return info.st_dev, info.st_ino, info.st_size, info.st_mtime_ns, info.st_ctime_ns


def inspect(source):
    info = source.lstat()
    if stat.S_ISDIR(info.st_mode):
        files = []
        for item in directory_files(source):
            item_info = item.lstat()
            if stat.S_ISREG(item_info.st_mode):
                files.append((item.relative_to(source).as_posix(), signature(item_info)))
        return True, tuple(files)
    if stat.S_ISREG(info.st_mode) and source.suffix.lower() in HTML | {'.zip', ''}:
        return False, ((source.name, signature(info)),)
    return None


def snapshot():
    entries = {}
    for source in sorted(SUBMISSIONS.iterdir()):
        if source.name in EXISTING or source.name.startswith('.'):
            continue
        try:
            result = inspect(source)
            if result is not None:
                entries[source] = result
        except FileNotFoundError:
            continue
    return entries


@contextmanager
def open_submission(path, expected):
    descriptor = os.open(path, os.O_RDONLY | os.O_NOFOLLOW | os.O_NONBLOCK)
    with os.fdopen(descriptor, 'rb') as source:
        info = os.fstat(source.fileno())
        if not stat.S_ISREG(info.st_mode) or signature(info) != expected:
            raise OSError(f'{path.name} changed while importing')
        yield source
        if signature(os.fstat(source.fileno())) != expected:
            raise OSError(f'{path.name} changed while importing')


def stage(source, record, destination):
    is_directory, members = record
    files = []
    used_paths = set()
    size = 0

    def copy_file(stream, relative, length):
        nonlocal size
        key = relative.as_posix().casefold()
        if key in used_paths:
            raise ValueError(f'duplicate path {relative}')
        if size + length > MAX_SIZE or len(files) >= MAX_FILES:
            raise ValueError('submission exceeds the local preview size limit')
        target = destination.joinpath(*relative.parts)
        target.parent.mkdir(parents=True, exist_ok=True)
        with target.open('xb') as output:
            remaining = length
            while remaining:
                data = stream.read(min(remaining, 1024 * 1024))
                if not data:
                    raise ValueError(f'incomplete file {relative}')
                output.write(data)
                remaining -= len(data)
            if stream.read(1):
                raise ValueError(f'file exceeds declared size: {relative}')
        size += length
        used_paths.add(key)
        files.append(relative)

    if is_directory or source.suffix.lower() in HTML:
        for name, expected in members:
            relative = PurePosixPath(name)
            file = source.joinpath(*relative.parts) if is_directory else source
            with open_submission(file, expected) as stream:
                copy_file(stream, relative, expected[2])
    else:
        with open_submission(source, members[0][1]) as stream, ZipFile(stream) as archive:
            for item in archive.infolist():
                relative = PurePosixPath(item.filename)
                file_type = stat.S_IFMT(item.external_attr >> 16)
                if (item.is_dir() or not supported(relative)
                        or file_type not in {0, stat.S_IFREG}):
                    continue
                with archive.open(item) as member:
                    copy_file(member, relative, item.file_size)

    pages = [item for item in files if item.suffix.lower() in HTML]
    if not pages:
        raise ValueError('no HTML entry page')
    return min(pages, key=lambda item: (item.stem.lower() != 'index', len(item.parts), str(item)))


def read_title(page):
    parser = Title()
    with page.open(encoding='utf-8-sig', errors='replace') as source:
        parser.feed(source.read(256 * 1024))
        parser.close()
    return ' '.join(''.join(parser.text).split())[:140]


def build_project(source, record):
    identifier = 'submission-' + sha256(os.fsencode(source.name)).hexdigest()[:16]
    revision = sha256(json.dumps(record).encode()).hexdigest()[:16]
    relative = Path(identifier, revision)
    destination = PREVIEWS / relative
    destination.parent.mkdir(exist_ok=True)
    if not destination.exists():
        with tempfile.TemporaryDirectory(prefix='.incoming-', dir=destination.parent) as temp:
            staging = Path(temp) / 'site'
            entry = stage(source, record, staging).as_posix()
            if inspect(source) != record:
                raise OSError('submission changed while importing')
            (staging / '.entry').write_text(entry, encoding='utf-8')
            staging.rename(destination)
    entry = (destination / '.entry').read_text(encoding='utf-8')
    student = re.sub(r'\s+project$', '', source.stem.strip(), flags=re.I)
    student = ' '.join(student.split()) or source.name
    original = (Path(source.name) / entry).as_posix() if record[0] else source.name
    return {
        'card': [identifier, read_title(destination / entry) or student, 'Student web project',
                 'Computer Science', student, 'slate', ['HTML'], original],
        'entry': entry,
        'previewPath': (relative / entry).as_posix(),
    }


def write_atomic(path, content):
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=path.parent,
                                    delete=False) as file:
        file.write(content)
    temporary = Path(file.name)
    try:
        temporary.replace(path)
    finally:
        temporary.unlink(missing_ok=True)


def build(entries, node):
    PREVIEWS.mkdir(exist_ok=True)
    manifest = STATE / 'catalog.json'
    try:
        previous = json.loads(manifest.read_text(encoding='utf-8'))
    except (FileNotFoundError, ValueError):
        previous = {}
    projects = {}
    for source, record in entries.items():
        if not record[1]:
            continue
        try:
            projects[source.name] = build_project(source, record)
        except (BadZipFile, ValueError, OSError, RuntimeError) as error:
            if source.name in previous:
                projects[source.name] = previous[source.name]
            print(f'Could not import {source.name}: {error}', flush=True)
    with tempfile.NamedTemporaryFile(mode='w', encoding='utf-8', dir=STATE,
                                    delete=False) as pending:
        json.dump(list(projects.values()), pending, ensure_ascii=True)
    pending_path = Path(pending.name)
    try:
        subprocess.run([node, 'scripts/build-preview.cjs'], cwd=PROJECT, check=True,
                       env={**os.environ, 'PROJECTHUB_PREVIEW_MANIFEST': str(pending_path)})
    finally:
        pending_path.unlink(missing_ok=True)
    write_atomic(manifest, json.dumps(projects, ensure_ascii=True))
    revision = sha256((PROJECT / 'ProjectHub Preview.html').read_bytes()).hexdigest()
    write_atomic(PREVIEWS / 'catalog-version.js',
                 f'window.projectHubCatalogRevision?.("{revision}");\n')
    print(f'Catalog updated. {len(projects)} automatically discovered submission(s).', flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--once', action='store_true', help='refresh once and exit')
    parser.add_argument('--interval', type=float, default=2, metavar='SECONDS',
                        help='time between folder checks (default: %(default)s)')
    args = parser.parse_args()
    if not math.isfinite(args.interval) or args.interval <= 0:
        parser.error('--interval must be a positive number of seconds')
    node = shutil.which('node')
    if node is None:
        parser.exit(1, 'ProjectHub preview requires Node.js on PATH.\n')
    with watcher_lock():
        if args.once:
            build(snapshot(), node)
            return
        pending = None
        applied = None
        print(f'Watching {SUBMISSIONS}', flush=True)
        while True:
            try:
                current = snapshot()
                if current == pending and current != applied:
                    build(current, node)
                    applied = current
                pending = current
            except (OSError, subprocess.CalledProcessError) as error:
                print(f'Catalog update failed; retrying: {error}', flush=True)
            time.sleep(args.interval)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt:
        pass
