import importlib.util
import json
import os
from pathlib import Path
import shutil
import subprocess
import tempfile
import unittest
from unittest.mock import patch
from zipfile import ZipFile


PROJECT = Path(__file__).resolve().parents[1]


class PreviewIntakeTest(unittest.TestCase):
    def setUp(self):
        directory = tempfile.TemporaryDirectory()
        self.addCleanup(directory.cleanup)
        self.root = Path(directory.name)
        self.project = self.root / 'projecthub'
        self.submissions = self.root / 'Student Web Projects'
        self.submissions.mkdir()
        for name in ('scripts', 'src', 'preview-projects'):
            shutil.copytree(PROJECT / name, self.project / name, ignore=shutil.ignore_patterns(
                'submission-*', 'catalog-version.js', '__pycache__',
            ))
        shutil.copyfile(PROJECT / 'tsconfig.json', self.project / 'tsconfig.json')
        (self.project / 'node_modules').symlink_to(PROJECT / 'node_modules', target_is_directory=True)
        self.script = self.project / 'scripts' / 'watch-preview.py'

    def refresh(self, *arguments):
        result = subprocess.run(
            ['python3', str(self.script), '--once', *arguments], cwd=self.project,
            env={key: value for key, value in os.environ.items() if key != 'PROJECTHUB_SUBMISSIONS'},
            capture_output=True, text=True,
        )
        self.assertEqual(result.returncode, 0, result.stderr)
        manifest = self.project / '.data' / 'preview' / 'catalog.json'
        return json.loads(manifest.read_text())

    def test_supported_submissions_updates_and_deletions(self):
        standalone = self.submissions / 'Student One.html'
        standalone.write_text('<title>Standalone submission</title>')
        folder = self.submissions / 'Student Two'
        (folder / 'assets').mkdir(parents=True)
        (folder / 'index.html').write_text('<title>Folder submission</title><link href="assets/style.css">')
        (folder / 'assets' / 'style.css').write_text('body { color: green; }')
        archive = self.submissions / 'Student Three.zip'
        with ZipFile(archive, 'w') as package:
            package.writestr('site/index.html', '<title>Archive submission</title>')
        old = self.submissions / 'Old'
        old.mkdir()
        (old / 'index.html').write_text('<title>Archive excluded from intake</title>')
        (self.root / 'unrelated.html').write_text('<title>Unrelated file</title>')

        cards = self.refresh()
        self.assertEqual(set(cards), {standalone.name, folder.name, archive.name})
        previews = self.project / 'preview-projects'
        folder_entry = previews / cards[folder.name]['previewPath']
        self.assertTrue((folder_entry.parent / 'assets' / 'style.css').is_file())
        self.assertTrue((previews / cards[archive.name]['previewPath']).is_file())
        catalog = self.project / 'ProjectHub Preview.html'
        self.assertIn('../Student%20Web%20Projects/Student%20One.html', catalog.read_text())

        original = cards[standalone.name]
        standalone.write_text('<title>Updated standalone submission</title>')
        archive.write_text('Incomplete archive')
        cards = self.refresh()
        updated = cards[standalone.name]
        self.assertEqual(updated['card'][0], original['card'][0])
        self.assertEqual(updated['card'][1], 'Updated standalone submission')
        self.assertTrue((previews / original['previewPath']).is_file())
        self.assertTrue((previews / cards[archive.name]['previewPath']).is_file())
        self.assertEqual(cards[archive.name]['card'][1], 'Archive submission')

        standalone.unlink()
        self.assertNotIn(standalone.name, self.refresh())
        self.assertFalse((previews / original['previewPath']).exists())
        self.assertNotIn('Updated standalone submission', catalog.read_text())

    def test_custom_source_and_retryable_import(self):
        intake = self.root / 'Explicit intake'
        intake.mkdir()
        submission = intake / 'Student.html'
        submission.write_text('<title>Previous project</title>')
        cards = self.refresh('--submissions', str(intake))
        catalog = self.project / 'ProjectHub Preview.html'
        self.assertIn('../Explicit%20intake/Student.html', catalog.read_text())

        spec = importlib.util.spec_from_file_location('watch_preview', self.script)
        watcher = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(watcher)
        watcher.SUBMISSIONS = intake
        submission.write_text('<title>Recovered project</title>')
        snapshot = watcher.snapshot()
        with patch.object(watcher, 'build_project', side_effect=OSError('interrupted')):
            self.assertFalse(watcher.build(snapshot, 'node'))
        self.assertIn('Previous project', catalog.read_text())
        self.assertTrue((watcher.PREVIEWS / cards[submission.name]['previewPath']).is_file())
        self.assertTrue(watcher.build(snapshot, 'node'))
        self.assertIn('Recovered project', catalog.read_text())
