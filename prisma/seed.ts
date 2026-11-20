import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../src/lib/password";
const db = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === "production")
    throw new Error("Development seed is disabled in production");
  const password = process.env.DEV_SEED_PASSWORD;
  if (!password || password.length < 12)
    throw new Error(
      "Set DEV_SEED_PASSWORD to a unique development-only password of at least 12 characters",
    );
  const passwordHash = await hashPassword(password),
    now = new Date();
  const categories = [
    "Computer Science",
    "Engineering",
    "Design & Arts",
    "Environmental Science",
    "Social Sciences",
    "Business",
    "Health Sciences",
    "Education",
  ];
  for (const name of categories)
    await db.category.upsert({ where: { name }, create: { name }, update: {} });
  const institution = await db.institution.upsert({
    where: { name: "Vine Iternational Christian Academy" },
    create: { name: "Vine Iternational Christian Academy" },
    update: {},
  });
  const people = [
    {
      id: "dev-amara",
      name: "Amina Demo",
      email: "amina.demo@vicacademy.org",
      role: "USER" as const,
      verified: true,
      skills: ["Sustainability", "IoT"],
    },
    {
      id: "dev-joshua",
      name: "Jonah Demo",
      email: "jonah.demo@vicacademy.org",
      role: "USER" as const,
      verified: true,
      skills: ["Python", "Machine Learning"],
    },
    {
      id: "dev-sarah",
      name: "Sara Demo",
      email: "sara.demo@vicacademy.org",
      role: "USER" as const,
      verified: true,
      skills: ["Figma", "Design"],
    },
    {
      id: "dev-michael",
      name: "Mika Demo",
      email: "mika.demo@vicacademy.org",
      role: "USER" as const,
      verified: true,
      skills: ["Arduino", "Engineering"],
    },
    {
      id: "dev-external",
      name: "Public Visitor Demo",
      email: "visitor@example.test",
      role: "USER" as const,
      verified: true,
      skills: ["Research"],
    },
    {
      id: "dev-unverified",
      name: "Unverified Student Demo",
      email: "unverified.demo@vicacademy.org",
      role: "USER" as const,
      verified: false,
      skills: ["Science"],
    },
    {
      id: "dev-teacher",
      name: "Teacher Demo",
      email: "teacher.demo@vicacademy.org",
      role: "TEACHER" as const,
      verified: true,
      skills: ["Education", "Research"],
    },
    {
      id: "dev-admin",
      name: "Administrator Demo",
      email: "admin.demo@vicacademy.org",
      role: "ADMIN" as const,
      verified: true,
      skills: ["Moderation"],
    },
  ];
  for (const person of people) {
    const eligible =
      person.verified && person.email.endsWith("@vicacademy.org");
    const identity = {
      name: person.name,
      email: person.email,
      role: person.role,
      emailVerified: person.verified ? now : null,
      passwordHash,
      termsAcceptedAt: now,
      communityAcceptedAt: now,
      privacyAcceptedAt: now,
      collaborationRulesAcceptedAt: eligible ? now : null,
      suspended: false,
      deletedAt: null,
    };
    await db.user.upsert({
      where: { id: person.id },
      create: {
        id: person.id,
        ...identity,
        profile: {
          create: {
            institution: "Vine Iternational Christian Academy",
            bio: "Fictional development account. No real personal data.",
            interests: person.skills,
            skills: person.skills,
            technologies: person.skills,
            links: [],
            public: true,
            showInstitution: true,
            showDomainBadge: eligible,
            showCollaborations: true,
            showAvailability: eligible,
            showInRankings: true,
          },
        },
      },
      update: {
        ...identity,
        profile: {
          upsert: {
            create: {
              institution: "Vine Iternational Christian Academy",
              bio: "Fictional development account.",
              interests: person.skills,
              skills: person.skills,
              technologies: person.skills,
              links: [],
              public: true,
            },
            update: {
              institution: "Vine Iternational Christian Academy",
              showInstitution: true,
              showInRankings: true,
            },
          },
        },
      },
    });
    for (const policy of [
      "TERMS",
      "COMMUNITY",
      "PRIVACY",
      ...(eligible ? ["COLLABORATION"] : []),
    ]) {
      const existing = await db.consent.findFirst({
        where: { userId: person.id, policy, version: "development-v1" },
      });
      if (!existing)
        await db.consent.create({
          data: { userId: person.id, policy, version: "development-v1" },
        });
    }
  }
  const course = await db.course.upsert({
    where: {
      name_institutionId: {
        name: "Interdisciplinary Capstone",
        institutionId: institution.id,
      },
    },
    create: {
      name: "Interdisciplinary Capstone",
      institutionId: institution.id,
      teacherId: "dev-teacher",
      description:
        "Development course combining research, engineering and responsible software design.",
    },
    update: { teacherId: "dev-teacher" },
  });
  await db.courseMembership.upsert({
    where: { courseId_userId: { courseId: course.id, userId: "dev-teacher" } },
    create: {
      courseId: course.id,
      userId: "dev-teacher",
      role: "TEACHER",
      status: "APPROVED",
    },
    update: { role: "TEACHER", status: "APPROVED" },
  });
  const group = await db.classGroup.upsert({
    where: {
      courseId_name: { courseId: course.id, name: "Class of Curious Makers" },
    },
    create: { courseId: course.id, name: "Class of Curious Makers" },
    update: {},
  });
  for (const person of people.filter(
    (p) => p.role === "USER" && p.email.endsWith("@vicacademy.org"),
  )) {
    await db.courseMembership.upsert({
      where: { courseId_userId: { courseId: course.id, userId: person.id } },
      create: {
        courseId: course.id,
        userId: person.id,
        status: person.verified ? "APPROVED" : "PENDING",
      },
      update: { status: person.verified ? "APPROVED" : "PENDING" },
    });
    if (person.verified)
      await db.classMember.upsert({
        where: { classId_userId: { classId: group.id, userId: person.id } },
        create: { classId: group.id, userId: person.id },
        update: {},
      });
  }
  const ideas = [
    [
      "greener-campus",
      "A greener campus, one sensor at a time",
      "An affordable IoT system helping campus gardens use less water and grow a little more.",
      "Environmental Science",
      "dev-amara",
      "forest",
      ["Arduino", "IoT", "Python"],
      "MIT",
      "PUBLIC",
    ],
    [
      "study-buddy",
      "StudyBuddy: learning, a little more personal",
      "An adaptive study companion turning course notes into meaningful practice and better learning.",
      "Computer Science",
      "dev-joshua",
      "violet",
      ["Python", "Next.js", "AI"],
      "Apache 2.0",
      "PUBLIC",
    ],
    [
      "accessible-campus",
      "A campus that works for everyone",
      "Mapping accessible routes so every student can feel at home on the Vine Iternational Christian Academy campus.",
      "Design & Arts",
      "dev-sarah",
      "clay",
      ["Figma", "Research", "Accessibility"],
      "CC BY 4.0",
      "PUBLIC",
    ],
    [
      "water-watch",
      "WaterWatch: every drop tells a story",
      "A low-cost water-quality monitor bringing useful real-time insights to community research.",
      "Engineering",
      "dev-michael",
      "ocean",
      ["Arduino", "C++", "Sensors"],
      "MIT",
      "PUBLIC",
    ],
    [
      "harvest-link",
      "HarvestLink: closer to the source",
      "Connecting local growers with student communities through a farm-to-campus marketplace.",
      "Business",
      "dev-amara",
      "gold",
      ["React", "PostgreSQL", "Research"],
      "All rights reserved",
      "PUBLIC",
    ],
    [
      "signs-together",
      "Breaking barriers, one sign at a time",
      "Exploring computer vision to make conversations more accessible for deaf students.",
      "Computer Science",
      "dev-joshua",
      "slate",
      ["Python", "OpenCV", "TensorFlow"],
      "GPL-3.0",
      "PUBLIC",
    ],
    [
      "community-roots",
      "Community roots, shared futures",
      "A field study on how student-led gardens build stronger community connections.",
      "Social Sciences",
      "dev-sarah",
      "forest",
      ["Research", "R", "Interviews"],
      "CC BY-SA 4.0",
      "INSTITUTION",
    ],
    [
      "solar-study",
      "A brighter place to learn",
      "Designing a portable solar study light using affordable and repairable components.",
      "Engineering",
      "dev-michael",
      "gold",
      ["CAD", "Arduino", "Solar"],
      "MIT",
      "COURSE",
    ],
    [
      "private-notes",
      "Private research notebook",
      "An unpublished research notebook for a future academic study and teacher review.",
      "Education",
      "dev-amara",
      "slate",
      ["Research"],
      "All rights reserved",
      "PRIVATE",
    ],
    [
      "unlisted-prototype",
      "Early prototype: shared learning spaces",
      "A work-in-progress prototype shared by link for constructive class feedback.",
      "Design & Arts",
      "dev-sarah",
      "clay",
      ["Figma"],
      "CC BY 4.0",
      "UNLISTED",
    ],
  ] as const;
  for (let n = 0; n < ideas.length; n++) {
    const [
      key,
      title,
      summary,
      subject,
      ownerId,
      cover,
      tools,
      license,
      visibility,
    ] = ideas[n];
    const category = await db.category.findUniqueOrThrow({
      where: { name: subject },
    });
    const description = `${summary}\n\nThe challenge\nOur team began with a practical question: how can student research make everyday life a little better? We reviewed published methods, collected consent-based feedback, and built a small prototype to test our assumptions.\n\nOur approach\nWe documented the development process and evaluated each iteration with our class. Third-party resources are credited in the project documentation.\n\nWhat we learned\nUseful results came from listening carefully, testing early, and keeping the work accessible.\n\nWhat comes next\nWe welcome eligible Vine Iternational Christian Academy collaborators interested in a careful pilot and improved documentation.`;
    const data = {
      title,
      summary,
      description,
      ownerId,
      categoryId: category.id,
      institutionId: institution.id,
      courseId: course.id,
      academicLevel: "Undergraduate",
      projectType: subject === "Engineering" ? "Hardware" : "Software",
      technologies: [...tools],
      languages: ([...tools] as readonly string[]).includes("Python")
        ? ["Python"]
        : [],
      cover,
      license,
      visibility,
      status: visibility === "PRIVATE" ? "DRAFT" : "PUBLISHED",
      rightsConfirmedAt: now,
      integrityStatement:
        "Development fixture: contributor permission and attribution are represented for testing only.",
      featured: n < 3,
      collaboration: n === 6 ? "LIMITED" : "OPEN",
      commentsApproval: true,
      commentPolicy: "MODERATED",
      clonePolicy: "MANUAL",
      publishedAt: new Date(Date.now() - (n + 1) * 86400000),
    };
    const project = await db.project.upsert({
      where: { id: `dev-${key}` },
      create: {
        id: `dev-${key}`,
        ...data,
        tags: {
          create: tools.map((name) => ({
            tag: { connectOrCreate: { where: { name }, create: { name } } },
          })),
        },
        contributors: {
          create: {
            name: people.find((p) => p.id === ownerId)!.name,
            contribution: "Research and development",
          },
        },
      },
      update: data,
    });
    await db.projectOwner.upsert({
      where: { projectId_userId: { projectId: project.id, userId: ownerId } },
      create: { projectId: project.id, userId: ownerId },
      update: {},
    });
    if (visibility === "PUBLIC") {
      for (let i = 0; i < 12 + n * 3; i++)
        await db.projectView.upsert({
          where: {
            projectId_visitorHash_day: {
              projectId: project.id,
              visitorHash: `development-visitor-${i}`,
              day: now.toISOString().slice(0, 10),
            },
          },
          create: {
            projectId: project.id,
            visitorHash: `development-visitor-${i}`,
            day: now.toISOString().slice(0, 10),
            totalViews: 1 + (i % 3),
          },
          update: {},
        });
      for (const person of people
        .filter((p) => p.verified && p.id !== ownerId && p.role === "USER")
        .slice(0, 3))
        for (const kind of ["LIKE", "BOOKMARK"])
          await db.engagement.upsert({
            where: {
              projectId_userId_kind: {
                projectId: project.id,
                userId: person.id,
                kind,
              },
            },
            create: { projectId: project.id, userId: person.id, kind },
            update: {},
          });
      await db.comment.upsert({
        where: { id: `dev-comment-${n}` },
        create: {
          id: `dev-comment-${n}`,
          projectId: project.id,
          userId: "dev-teacher",
          body: "Thoughtful work. How might you evaluate the prototype in a larger, consent-based pilot?",
        },
        update: {},
      });
      await db.projectVersion.upsert({
        where: { projectId_label: { projectId: project.id, label: "1.0.0" } },
        create: {
          projectId: project.id,
          label: "1.0.0",
          title: "Class showcase release",
          notes:
            "Initial documented version prepared for the Vine Iternational Christian Academy class showcase.",
          authorId: ownerId,
          status: "PUBLISHED",
          publishedAt: now,
          snapshot: {
            title,
            summary,
            description,
            technologies: [...tools],
            languages: data.languages,
            license,
            customLicense: "",
            tags: [...tools],
            links: [],
            contributors: [],
            fileIds: [],
          },
        },
        update: {},
      });
    }
  }
  await db.projectOwner.upsert({
    where: {
      projectId_userId: {
        projectId: "dev-greener-campus",
        userId: "dev-joshua",
      },
    },
    create: { projectId: "dev-greener-campus", userId: "dev-joshua" },
    update: {},
  });
  for (const [type, userId] of [
    ["COLLABORATION", "dev-joshua"],
    ["CLONE", "dev-external"],
    ["COMMENT", "dev-michael"],
  ] as const)
    await db.request.upsert({
      where: { id: `dev-request-${type}` },
      create: {
        id: `dev-request-${type}`,
        projectId: "dev-greener-campus",
        userId,
        type,
        message:
          "I would like to contribute careful testing and clearly attributed academic research.",
        details: {
          skills: "Research and software",
          contribution: "Prototype testing",
          responsibilities: "Document results",
          availability: "Weekly",
          communication: "In-app",
          duration: "One term",
          reason: "Academic research",
          intendedUse: "Study and extension",
          modifications: "Accessibility",
          visibility: "PRIVATE",
          attributionPlan: "Credit and link to the original authors",
          licenseAgreed: true,
        },
      },
      update: {},
    });
  await db.collaborator.upsert({
    where: {
      projectId_userId: { projectId: "dev-water-watch", userId: "dev-amara" },
    },
    create: {
      projectId: "dev-water-watch",
      userId: "dev-amara",
      permission: "CONTRIBUTOR",
    },
    update: {},
  });
  await db.notification.upsert({
    where: { id: "dev-welcome" },
    create: {
      id: "dev-welcome",
      userId: "dev-amara",
      title:
        "Welcome to Vine Iternational Christian Academy ProjectHub. Your next collaboration starts here.",
      href: "/requests",
    },
    update: {},
  });
  const assignment = await db.assignment.upsert({
    where: { id: "dev-assignment" },
    create: {
      id: "dev-assignment",
      courseId: course.id,
      title: "Capstone prototype and research reflection",
      description:
        "Submit a project with clear attribution, an evaluation plan, and accessible documentation.",
      deadline: new Date(Date.now() + 30 * 86400000),
      rubric: [
        { criterion: "Educational value", weight: 40 },
        { criterion: "Technical quality", weight: 40 },
        { criterion: "Documentation", weight: 20 },
      ],
      maxScore: 100,
      requiresReview: true,
    },
    update: {},
  });
  await db.submission.upsert({
    where: {
      assignmentId_projectId: {
        assignmentId: assignment.id,
        projectId: "dev-greener-campus",
      },
    },
    create: {
      assignmentId: assignment.id,
      projectId: "dev-greener-campus",
      userId: "dev-amara",
      status: "APPROVED",
      grade: 88,
      feedback:
        "Private synthetic teacher feedback: clear methods and promising next steps.",
    },
    update: {},
  });
  const collection = await db.courseCollection.upsert({
    where: { id: "dev-showcase" },
    create: {
      id: "dev-showcase",
      courseId: course.id,
      title: "Vine Iternational Christian Academy Capstone Showcase",
      public: true,
    },
    update: {},
  });
  await db.collectionProject.upsert({
    where: {
      collectionId_projectId: {
        collectionId: collection.id,
        projectId: "dev-greener-campus",
      },
    },
    create: { collectionId: collection.id, projectId: "dev-greener-campus" },
    update: {},
  });
  await db.workspaceTask.upsert({
    where: { id: "dev-task" },
    create: {
      id: "dev-task",
      projectId: "dev-water-watch",
      title: "Calibrate the prototype",
      description:
        "Record baseline sensor readings using the approved protocol.",
      status: "TODO",
      assigneeId: "dev-amara",
      milestone: true,
      dueAt: new Date(Date.now() + 7 * 86400000),
    },
    update: {},
  });
  await db.report.upsert({
    where: { id: "dev-report" },
    create: {
      id: "dev-report",
      userId: "dev-external",
      targetId: "dev-greener-campus",
      targetType: "PROJECT",
      category: "INTEGRITY",
      reason:
        "Synthetic development report for testing the academic-integrity moderation queue.",
    },
    update: {},
  });
  for (const [key, name, text, url] of [
    [
      "MIT",
      "MIT License",
      "Use the full MIT license text in your project repository.",
      "https://opensource.org/license/mit",
    ],
    [
      "CC BY-NC 4.0",
      "Creative Commons Attribution-NonCommercial 4.0",
      "Attribution required; commercial use restricted.",
      "https://creativecommons.org/licenses/by-nc/4.0/",
    ],
    [
      "All rights reserved",
      "All rights reserved",
      "Permission from the rights holder is required for copying or redistribution.",
      null,
    ],
  ] as const)
    await db.licenseDefinition.upsert({
      where: { key },
      create: { key, name, text, url },
      update: {},
    });
  console.log(
    "Development-only fixtures loaded. All identities are synthetic. Password came exclusively from DEV_SEED_PASSWORD.",
  );
}
main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : "Seed failed");
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
