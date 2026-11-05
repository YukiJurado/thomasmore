export async function findAllEvents() {
  return Event.findAll({
    order: [['startsAt', 'ASC']]
  });
}