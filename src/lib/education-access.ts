import { db } from "./db";
import { HttpError } from "./security";
import {
  canTeachCourse,
  canReadCourse,
  type EducationActor,
} from "./education";
export async function courseAccess(
  user: EducationActor,
  id: string,
  instructor = false,
) {
  const course = await db.course.findUnique({
    where: { id },
    include: { memberships: { where: { userId: user.id } } },
  });
  if (
    !course ||
    !(instructor
      ? canTeachCourse(user, course, course.memberships)
      : canReadCourse(user, course, course.memberships))
  )
    throw new HttpError(404, "Course unavailable");
  return course;
}
