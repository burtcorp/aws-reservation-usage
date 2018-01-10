const AWS = require('aws-sdk')
const {relativeSize} = require('./helpers')

const ACTIVE_RESERVATIONS_FILTER = [{Name: 'state', Values: ['active']}]
const RUNNING_INSTANCES_FILTER = [{Name: 'instance-state-name', Values: ['running']}]

const RESULT_CACHE = {}

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

function isSpot(instance) {
  return instance.InstanceLifecycle == 'spot'
}

function isEmr(instance) {
  return instance.Tags.some(tag => tag.Key === 'aws:elasticmapreduce:job-flow-id')
}

function isPermanentInstance(instance) {
  return !isSpot(instance) && !isEmr(instance)
}

const EC2_CLIENTS = {}

module.exports = class EC2 {
  constructor(ec2ClientFactory = null, ec2ClientCache = null, resultCache = null) {
    this._ec2ClientFactory = ec2ClientFactory || AWS.EC2
    this._ec2ClientCache = ec2ClientCache || EC2_CLIENTS
    this._resultCache = resultCache || RESULT_CACHE
    this._resultCache.reservations = this._resultCache.reservations || {}
    this._resultCache.instances = this._resultCache.instances || {}
  }

  _ec2Client(region) {
    let client = this._ec2ClientCache[region]
    if (!client) {
      client = this._ec2ClientCache[region] = new this._ec2ClientFactory({region})
    }
    return client
  }

  loadReservations(region) {
    return this._cacheResult('reservations', region, () => {
      return this._ec2Client(region)
        .describeReservedInstances({Filters: ACTIVE_RESERVATIONS_FILTER})
        .promise()
        .then((response) => response.ReservedInstances.map(createReservation))
    })
  }

  loadInstances(region) {
    return this._cacheResult('instances', region, () => {
      return this._ec2Client(region)
        .describeInstances({Filters: RUNNING_INSTANCES_FILTER})
        .promise()
        .then((response) => response.Reservations.reduce((all, reservation) => all.concat(reservation.Instances.filter(isPermanentInstance).map(createInstance)), []))
    })
  }

  _cacheResult(cacheScope, cacheKey, action) {
    let result = this._resultCache[cacheScope][cacheKey]
    if (result == null) {
      result = this._resultCache[cacheScope][cacheKey] = action()
    }
    return result
  }
}
