const AWS = require('aws-sdk')
const {relativeSize} = require('./helpers')

const ACTIVE_RESERVATIONS_FILTER = [{Name: 'state', Values: ['active']}]
const RUNNING_INSTANCES_FILTER = [{Name: 'instance-state-name', Values: ['running']}]

const INSTANCES_CACHE_DURATION = 300000
const RESERVATIONS_CACHE_DURATION = 3600000

const RESULT_CACHE = {}
const EC2_CLIENTS = {}

module.exports = class EC2 {
  constructor(ec2ClientFactory = null, ec2ClientCache = null, resultCache = null, clock = null) {
    this._ec2ClientFactory = ec2ClientFactory || AWS.EC2
    this._ec2ClientCache = ec2ClientCache || EC2_CLIENTS
    this._resultCache = resultCache || RESULT_CACHE
    this._clock = clock || Date
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
    return this._cacheResult('reservations', region, RESERVATIONS_CACHE_DURATION, () => {
      return this._ec2Client(region)
        .describeReservedInstances({Filters: ACTIVE_RESERVATIONS_FILTER})
        .promise()
        .then((response) => response.ReservedInstances.map(r => this._createReservation(r)))
    })
  }

  loadInstances(region) {
    return this._cacheResult('instances', region, INSTANCES_CACHE_DURATION, () => {
      return this._ec2Client(region)
        .describeInstances({Filters: RUNNING_INSTANCES_FILTER})
        .promise()
        .then((response) => response.Reservations.reduce((all, reservation) => all.concat(reservation.Instances.map(i => this._createInstance(i))), []))
    })
  }

  _cacheResult(cacheScope, cacheKey, cacheDuration, action) {
    let resultContainer = this._resultCache[cacheScope][cacheKey]
    if (resultContainer == null || this._clock.now - resultContainer.createdAt >= cacheDuration) {
      const result = action()
      resultContainer = {result, createdAt: this._clock.now}
      this._resultCache[cacheScope][cacheKey] = resultContainer
    }
    return resultContainer.result
  }

  _createReservation(reservation) {
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

  _createInstance(instance) {
    const [family, size] = instance.InstanceType.split('.')
    const az = instance.Placement.AvailabilityZone
    const spot = this._isSpot(instance)
    const emr = this._isEmr(instance)
    return {
      family,
      size,
      az,
      emr,
      spot,
      units: relativeSize(size),
    }
  }

  _isSpot(instance) {
    return instance.InstanceLifecycle == 'spot'
  }

  _isEmr(instance) {
    return instance.Tags.some(tag => tag.Key === 'aws:elasticmapreduce:job-flow-id')
  }
}
