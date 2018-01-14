const ReservationManager = require('./reservation_manager')

module.exports = class Summarizer {
  constructor(reservations, instances) {
    this._runningInstances = instances
    this._reservations = reservations
    this._spotInstances = []
    this._emrInstances = []
    this._onDemandInstances = []
    this._reservableInstances = []
    this._reservationManager = new ReservationManager(this._reservations)
  }

  summarize() {
    this._matchReservations()
    return this._summarizeFindings()
  }

  _matchReservations() {
    this._runningInstances.forEach((instance) => {
      if (instance.spot) {
        this._spotInstances.push(instance)
      } else {
        const reservation = this._reservationManager.consumeReservedCapacity(instance)
        if (instance.emr) {
          this._emrInstances.push(instance)
        } else {
          if (reservation == null) {
            this._reservableInstances.push(instance)
          }
          this._onDemandInstances.push(instance)
        }
      }
    })
  }

  _summarizeFindings() {
    const summaries = {
      running: this._summarizeByFamily(this._runningInstances, 'units'),
      spot: this._summarizeByFamily(this._spotInstances, 'units'),
      emr: this._summarizeByFamily(this._emrInstances, 'units'),
      reserved: this._summarizeByFamily(this._reservations, 'units'),
      reservable: this._summarizeByFamily(this._reservableInstances, 'units'),
      surplus: this._summarizeByFamily(this._reservationManager.unusedReservedCapacity(), 'remainingUnits'),
    }
    const families = this._sortedKeys(...Object.keys(summaries).map(k => summaries[k]))
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
