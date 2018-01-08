class Reservation {
  constructor(properties) {
    this.offeringClass = properties.offeringClass
    this.az = properties.az
    this.family = properties.family
    this.size = properties.size
    this.units = properties.units
    this.remainingUnits = this.units
  }

  isStandardZonalReservationFor(instance) {
    return this.offeringClass == 'standard'
      && this.az == instance.az
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isBestStandardRegionalReservationFor(instance) {
    return this.offeringClass == 'standard'
      && this.az == '*'
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isStandardRegionalReservationFor(instance) {
    return this.offeringClass == 'standard'
      && this.az == '*'
      && this.family == instance.family
      && this.remainingUnits >= instance.units
  }

  isBestConvertibleRegionalReservationFor(instance) {
    return this.offeringClass == 'convertible'
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isConvertibleRegionalReservationFor(instance) {
    return this.offeringClass == 'convertible'
      && this.family == instance.family
      && this.remainingUnits >= instance.units
  }

  consumeUnits(count) {
    if (this.remainingUnits >= count) {
      this.remainingUnits -= count
    } else {
      throw new Error(`Not enough remaining units to consume (remaining: ${this.remainingUnits}, needed: ${count})`)
    }
  }
}

module.exports = class ReservationManager {
  constructor(reservations) {
    this._reservations = reservations.map((r) => new Reservation(r))
  }

  get reservations() {
    return this._reservations
  }

  _findMatchingReservation(instance) {
    return this._reservations.find(r => r.isStandardZonalReservationFor(instance))
      || this._reservations.find(r => r.isBestStandardRegionalReservationFor(instance))
      || this._reservations.find(r => r.isStandardRegionalReservationFor(instance))
      || this._reservations.find(r => r.isBestConvertibleRegionalReservationFor(instance))
      || this._reservations.find(r => r.isConvertibleRegionalReservationFor(instance))
      || null
  }

  consumeReservedCapacity(instance) {
    const reservation = this._findMatchingReservation(instance)
    if (reservation) {
      reservation.consumeUnits(instance.units)
    }
    return reservation
  }

  unusedReservedCapacity() {
    return this._reservations.filter(r => r.remainingUnits > 0)
  }
}
