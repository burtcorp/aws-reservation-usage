const {relativeSize} = require('./helpers')

const ACTIVE_RESERVATIONS_FILTER = [{Name: 'state', Values: ['active']}]
const RUNNING_INSTANCES_FILTER = [{Name: 'instance-state-name', Values: ['running']}]

function createReservation(reservation) {
  const id = reservation.ReservedInstancesId
  const [family, size] = reservation.InstanceType.split('.')
  const offeringClass = reservation.OfferingClass
  const scope = reservation.Scope
  const az = scope == 'Region' ? '*' : reservation.AvailabilityZone
  const count = reservation.InstanceCount
  return {
    id,
    family,
    size,
    offeringClass,
    az,
    count,
    units: count * relativeSize(size),
  }
}

function createInstance(instance) {
  const [family, size] = instance.InstanceType.split('.')
  const az = instance.Placement.AvailabilityZone
  return {
    family,
    size,
    az,
    units: relativeSize(size),
  }
}

function isPermanentInstance(instance) {
  return instance.InstanceLifecycle != 'spot' && !instance.Tags.some((tag) => tag.Name === 'aws:elasticmapreduce:job-flow-id')
}

module.exports = class EC2 {
  constructor(client) {
    this._client = client
  }

  loadReservations() {
    return this._client
      .describeReservedInstances({Filters: ACTIVE_RESERVATIONS_FILTER})
      .promise()
      .then((response) => response.ReservedInstances.map(createReservation))
  }

  loadInstances() {
    return this._client
      .describeInstances({Filters: RUNNING_INSTANCES_FILTER})
      .promise()
      .then((response) => response.Reservations.reduce((all, reservation) => all.concat(reservation.Instances.filter(isPermanentInstance).map(createInstance)), []))
  }
}
