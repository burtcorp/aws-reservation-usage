const ReservationManager = require('./reservation_manager')

module.exports = class Summarizer {
  constructor(reservations, instances) {
    this._instances = instances
    this._reservations = reservations
    this._spotInstances = []
    this._emrInstances = []
    this._onDemandInstances = []
    this._unreservedInstances = []
    this._reservationManager = new ReservationManager(this._reservations)
  }

  summarize() {
    this._matchReservations()
    return this._summarizeFindings()
  }

  _matchReservations() {
    this._instances.forEach((instance) => {
      if (instance.spot) {
        this._spotInstances.push(instance)
      } else {
        const reservation = this._reservationManager.consumeReservedCapacity(instance)
        if (reservation == null) {
          this._unreservedInstances.push(instance)
        }
        if (instance.emr) {
          this._emrInstances.push(instance)
        } else {
          this._onDemandInstances.push(instance)
        }
      }
    })
  }

  _summarizeFindings() {
    const summaries = {
      onDemand: this._summarizeByFamily(this._onDemandInstances, 'units'),
      spot: this._summarizeByFamily(this._spotInstances, 'units'),
      emr: this._summarizeByFamily(this._emrInstances, 'units'),
      reserved: this._summarizeByFamily(this._reservations, 'units'),
      unreserved: this._summarizeByFamily(this._unreservedInstances, 'units'),
      surplus: this._summarizeByFamily(this._reservationManager.unusedReservedCapacity(), 'remainingUnits'),
    }
    const families = this._sortedKeys(summaries.onDemand, summaries.spot, summaries.emr, summaries.reserved)
    return families.map((family) => {
      const row = {family}
      for (let column in summaries) {
        row[column] = summaries[column][family] || 0
      }
      return row
    })
  }

  _sortedKeys(...objs) {
    let keys = objs.reduce((keys, o) => keys.concat(Object.keys(o)), [])
    keys = new Set(keys)
    keys = [...keys].sort()
    return keys
  }

  _summarizeByFamily(objs, property) {
    const summary = {}
    objs.forEach((instance) => {
      summary[instance.family] = (summary[instance.family] || 0) + instance[property]
    })
    return summary
  }
}
