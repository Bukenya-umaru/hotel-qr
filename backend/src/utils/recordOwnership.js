export const canEditRecord = (record, user) => {
  if (user?.role === 'OWNER') return true
  const creator = record?.recordedBy || record?.createdBy
  const creatorId = creator?._id || creator
  return Boolean(creatorId && user?._id && String(creatorId) === String(user._id))
}
