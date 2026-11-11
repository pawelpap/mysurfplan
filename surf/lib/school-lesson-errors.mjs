export function schoolLessonError(error) {
  const code=error?.code;
  const status=({'42501':403,'P0002':404,'22023':400,'23514':409,'40001':409,'40P01':409})[code]||503;
  const message=status===403?'schoolLocation.forbidden':status===404?'Lesson not found':
    code==='23514'?'schoolLocation.capacityConflict':status===409?'schoolLocation.lessonConflict':
    status===400?(error?.message==='Choose an active school operating spot'?'schoolLocation.spotNotAllowed':'schoolLocation.lessonInvalid'):'schoolLocation.unavailable';
  return {status,message};
}
