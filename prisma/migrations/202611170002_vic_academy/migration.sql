-- Additive Vic Academy identity, project lifecycle, education, and privacy model.
-- Existing identity/project rows remain intact.

ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'TEACHER';

ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'INSTITUTION';

ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'COURSE';

ALTER TYPE "Visibility" ADD VALUE IF NOT EXISTS 'SCHEDULED';

ALTER TYPE "RequestStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';

ALTER TABLE "User" ADD COLUMN "passwordHash" TEXT;

ALTER TABLE "User" ADD COLUMN "studentId" TEXT;

ALTER TABLE "User" ADD COLUMN "termsAcceptedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "communityAcceptedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "privacyAcceptedAt" TIMESTAMP(3);

ALTER TABLE "User" ADD COLUMN "collaborationRulesAcceptedAt" TIMESTAMP(3);

ALTER TABLE "Profile" ADD COLUMN "showInstitution" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile" ADD COLUMN "showDomainBadge" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile" ADD COLUMN "showCollaborations" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile" ADD COLUMN "showAvailability" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile" ADD COLUMN "showInRankings" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Profile" ADD COLUMN "personalizedRecommendations" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "Course" ADD COLUMN "teacherId" TEXT;

ALTER TABLE "Course" ADD COLUMN "description" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Course" ADD COLUMN "archived" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "Project" ADD COLUMN "customLicense" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Project" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'DRAFT';

ALTER TABLE "Project" ADD COLUMN "scheduledAt" TIMESTAMP(3);

ALTER TABLE "Project" ADD COLUMN "languages" TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE "Project" ADD COLUMN "commentPolicy" TEXT NOT NULL DEFAULT 'MODERATED';

ALTER TABLE "Project" ADD COLUMN "clonePolicy" TEXT NOT NULL DEFAULT 'MANUAL';

ALTER TABLE "Project" ADD COLUMN "rightsConfirmedAt" TIMESTAMP(3);

ALTER TABLE "Project" ADD COLUMN "integrityStatement" TEXT NOT NULL DEFAULT '';

ALTER TABLE "Project" ADD COLUMN "recommendable" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "ProjectFile" ADD COLUMN "versionId" TEXT;

ALTER TABLE "Request" ADD COLUMN "privateNote" TEXT;

ALTER TABLE "Request" ADD COLUMN "expiresAt" TIMESTAMP(3);

ALTER TABLE "Report" ADD COLUMN "category" TEXT NOT NULL DEFAULT 'GENERAL';

CREATE TABLE "EmailChallenge" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "purpose" TEXT NOT NULL,
  "secretHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "usedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Consent" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "policy" TEXT NOT NULL,
  "version" TEXT NOT NULL,
  "acceptedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "ProjectOwner" (
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("projectId", "userId")
);

CREATE TABLE "OwnershipTransfer" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "fromUserId" TEXT NOT NULL,
  "toUserId" TEXT NOT NULL,
  "kind" TEXT NOT NULL DEFAULT 'TRANSFER',
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolvedAt" TIMESTAMP(3)
);

CREATE TABLE "ProjectVersion" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "label" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "notes" TEXT NOT NULL,
  "snapshot" JSONB NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DRAFT',
  "authorId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3)
);

CREATE TABLE "CourseMembership" (
  "courseId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "role" TEXT NOT NULL DEFAULT 'STUDENT',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("courseId", "userId")
);

CREATE TABLE "ClassGroup" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "name" TEXT NOT NULL
);

CREATE TABLE "ClassMember" (
  "classId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  PRIMARY KEY ("classId", "userId")
);

CREATE TABLE "Assignment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "deadline" TIMESTAMP(3),
  "rubric" JSONB NOT NULL DEFAULT '[]',
  "maxScore" DOUBLE PRECISION NOT NULL DEFAULT 100,
  "requiresReview" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "Submission" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "assignmentId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'SUBMITTED',
  "grade" DOUBLE PRECISION,
  "feedback" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "CourseCollection" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "courseId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "public" BOOLEAN NOT NULL DEFAULT false
);

CREATE TABLE "CollectionProject" (
  "collectionId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  PRIMARY KEY ("collectionId", "projectId")
);

CREATE TABLE "WorkspaceTask" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "projectId" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL DEFAULT '',
  "status" TEXT NOT NULL DEFAULT 'TODO',
  "assigneeId" TEXT,
  "dueAt" TIMESTAMP(3),
  "milestone" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "UserBlock" (
  "blockerId" TEXT NOT NULL,
  "blockedId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("blockerId", "blockedId")
);

CREATE TABLE "FollowedCategory" (
  "userId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  PRIMARY KEY ("userId", "categoryId")
);

CREATE TABLE "SavedSearch" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "userId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "query" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE "PlatformSetting" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "value" JSONB NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL
);

CREATE TABLE "LicenseDefinition" (
  "key" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "text" TEXT NOT NULL,
  "url" TEXT
);

CREATE TABLE "NotificationPreference" (
  "userId" TEXT NOT NULL,
  "kind" TEXT NOT NULL,
  "email" BOOLEAN NOT NULL DEFAULT true,
  "inApp" BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY ("userId", "kind")
);

CREATE TABLE "ProjectFollow" (
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY ("userId", "projectId")
);

CREATE TABLE "ViewHistory" (
  "userId" TEXT NOT NULL,
  "projectId" TEXT NOT NULL,
  "viewedAt" TIMESTAMP(3) NOT NULL,
  PRIMARY KEY ("userId", "projectId")
);

CREATE INDEX "User_emailVerified_suspended_idx" ON "User" ("emailVerified", "suspended");

CREATE INDEX "Project_status_visibility_scheduledAt_idx" ON "Project" ("status", "visibility", "scheduledAt");

CREATE INDEX "EmailChallenge_userId_purpose_createdAt_idx" ON "EmailChallenge" ("userId", "purpose", "createdAt");

CREATE INDEX "EmailChallenge_email_purpose_expiresAt_idx" ON "EmailChallenge" ("email", "purpose", "expiresAt");

CREATE INDEX "Consent_userId_policy_idx" ON "Consent" ("userId", "policy");

CREATE INDEX "ProjectOwner_userId_idx" ON "ProjectOwner" ("userId");

CREATE INDEX "OwnershipTransfer_projectId_status_idx" ON "OwnershipTransfer" ("projectId", "status");

CREATE INDEX "OwnershipTransfer_toUserId_status_idx" ON "OwnershipTransfer" ("toUserId", "status");

CREATE UNIQUE INDEX "ProjectVersion_projectId_label_key" ON "ProjectVersion" ("projectId", "label");

CREATE INDEX "ProjectVersion_projectId_status_publishedAt_idx" ON "ProjectVersion" ("projectId", "status", "publishedAt");

CREATE INDEX "CourseMembership_userId_status_idx" ON "CourseMembership" ("userId", "status");

CREATE UNIQUE INDEX "ClassGroup_courseId_name_key" ON "ClassGroup" ("courseId", "name");

CREATE INDEX "Assignment_courseId_deadline_idx" ON "Assignment" ("courseId", "deadline");

CREATE UNIQUE INDEX "Submission_assignmentId_projectId_key" ON "Submission" ("assignmentId", "projectId");

CREATE INDEX "Submission_userId_status_idx" ON "Submission" ("userId", "status");

CREATE INDEX "CourseCollection_courseId_public_idx" ON "CourseCollection" ("courseId", "public");

CREATE INDEX "WorkspaceTask_projectId_status_dueAt_idx" ON "WorkspaceTask" ("projectId", "status", "dueAt");

CREATE INDEX "UserBlock_blockedId_idx" ON "UserBlock" ("blockedId");

CREATE INDEX "SavedSearch_userId_createdAt_idx" ON "SavedSearch" ("userId", "createdAt");

CREATE INDEX "ViewHistory_userId_viewedAt_idx" ON "ViewHistory" ("userId", "viewedAt");

ALTER TABLE "Course" ADD CONSTRAINT "Course_teacherId_fkey" FOREIGN KEY ("teacherId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ProjectFile" ADD CONSTRAINT "ProjectFile_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "ProjectVersion"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Consent" ADD CONSTRAINT "Consent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectOwner" ADD CONSTRAINT "ProjectOwner_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectOwner" ADD CONSTRAINT "ProjectOwner_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_fromUserId_fkey" FOREIGN KEY ("fromUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_toUserId_fkey" FOREIGN KEY ("toUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CourseMembership" ADD CONSTRAINT "CourseMembership_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassGroup" ADD CONSTRAINT "ClassGroup_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_classId_fkey" FOREIGN KEY ("classId") REFERENCES "ClassGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ClassMember" ADD CONSTRAINT "ClassMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_assignmentId_fkey" FOREIGN KEY ("assignmentId") REFERENCES "Assignment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CourseCollection" ADD CONSTRAINT "CourseCollection_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionProject" ADD CONSTRAINT "CollectionProject_collectionId_fkey" FOREIGN KEY ("collectionId") REFERENCES "CourseCollection"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CollectionProject" ADD CONSTRAINT "CollectionProject_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTask" ADD CONSTRAINT "WorkspaceTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "WorkspaceTask" ADD CONSTRAINT "WorkspaceTask_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockerId_fkey" FOREIGN KEY ("blockerId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_blockedId_fkey" FOREIGN KEY ("blockedId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowedCategory" ADD CONSTRAINT "FollowedCategory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FollowedCategory" ADD CONSTRAINT "FollowedCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "SavedSearch" ADD CONSTRAINT "SavedSearch_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProjectFollow" ADD CONSTRAINT "ProjectFollow_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ViewHistory" ADD CONSTRAINT "ViewHistory_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project"("id") ON DELETE CASCADE ON UPDATE CASCADE;

INSERT INTO "ProjectOwner" ("projectId", "userId", "addedAt")
SELECT id, "ownerId", "createdAt" FROM "Project" ON CONFLICT DO NOTHING;

CREATE UNIQUE INDEX "OwnershipTransfer_active_recipient" ON "OwnershipTransfer" ("projectId", "toUserId", kind) WHERE status='PENDING';

ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_attempts_check" CHECK (attempts >= 0 AND attempts <= 100);

ALTER TABLE "UserBlock" ADD CONSTRAINT "UserBlock_not_self" CHECK ("blockerId" <> "blockedId");

ALTER TABLE "Assignment" ADD CONSTRAINT "Assignment_maxScore_check" CHECK ("maxScore" > 0);

ALTER TABLE "Submission" ADD CONSTRAINT "Submission_grade_check" CHECK (grade IS NULL OR grade >= 0);

CREATE INDEX "User_vic_eligibility_idx" ON "User" ("emailVerified", "collaborationRulesAcceptedAt") WHERE email LIKE '%@vicacademy.org' AND NOT suspended AND "deletedAt" IS NULL;

CREATE OR REPLACE FUNCTION enforce_vic_collaborator_eligibility() RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM "User" WHERE id=NEW."userId" AND "emailVerified" IS NOT NULL
    AND lower(email) ~ '^[a-z0-9.!#$%&''*+/=?^_`{|}~-]+@vicacademy[.]org$'
    AND "collaborationRulesAcceptedAt" IS NOT NULL AND NOT suspended AND "deletedAt" IS NULL)
  THEN RAISE EXCEPTION 'Collaboration requires an eligible verified Vic Academy account' USING ERRCODE='42501'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "Collaborator_vic_eligibility" BEFORE INSERT OR UPDATE ON "Collaborator"
FOR EACH ROW EXECUTE FUNCTION enforce_vic_collaborator_eligibility();

-- Canonical identity and single active challenge per purpose reinforce API-level normalization/locking.
CREATE UNIQUE INDEX "User_email_normalized_key" ON "User" (lower(email)) WHERE email IS NOT NULL;
ALTER TABLE "User" ADD CONSTRAINT "User_email_normalized_check" CHECK (email IS NULL OR email=lower(btrim(email)));
CREATE UNIQUE INDEX "EmailChallenge_one_active_purpose" ON "EmailChallenge" ("userId", purpose) WHERE "usedAt" IS NULL;
ALTER TABLE "EmailChallenge" ADD CONSTRAINT "EmailChallenge_purpose_check" CHECK (purpose IN ('VERIFY','RESET','EMAIL_CHANGE'));
ALTER TABLE "ProjectVersion" ADD CONSTRAINT "ProjectVersion_status_check" CHECK (status IN ('DRAFT','PUBLISHED','ARCHIVED'));
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_kind_check" CHECK (kind IN ('TRANSFER','ADD_OWNER'));
ALTER TABLE "OwnershipTransfer" ADD CONSTRAINT "OwnershipTransfer_not_self" CHECK ("fromUserId" <> "toUserId");
