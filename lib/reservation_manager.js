class Reservation {
  constructor(properties) {
    this.offeringClass = properties.offeringClass
    this.az = properties.az
    this.family = properties.family
    this.size = properties.size
    this.units = properties.units
    this.remainingUnits = this.units
  }

  isBestMachingStandardReservationFor(instance) {
    return this.offeringClass == 'standard'
      && this.az == instance.az
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isMatchingStandardReservationFor(instance) {
    return this.offeringClass == 'standard'
      && this.az == '*'
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isBestMatchingConvertibleReservationFor(instance) {
    return this.offeringClass == 'convertible'
      && this.family == instance.family
      && this.size == instance.size
      && this.remainingUnits >= instance.units
  }

  isMatchingConvertibleReservationFor(instance) {
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

  _findMatchingReservation(instance) {
    return this._reservations.find(r => r.isBestMachingStandardReservationFor(instance))
      || this._reservations.find(r => r.isMatchingStandardReservationFor(instance))
      || this._reservations.find(r => r.isBestMatchingConvertibleReservationFor(instance))
      || this._reservations.find(r => r.isMatchingConvertibleReservationFor(instance))
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
