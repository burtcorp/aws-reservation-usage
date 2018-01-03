class Reservation {
  constructor(properties) {
    this._offeringClass = properties.offeringClass
    this._az = properties.az
    this._family = properties.family
    this._size = properties.size
    this._units = properties.units
    this._remainingUnits = this.units
  }

  get offeringClass() { return this._offeringClass }

  get az() { return this._az }

  get family() { return this._family }

  get size() { return this._size }

  get units() { return this._units }

  get remainingUnits() { return this._remainingUnits }

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
    if (this._remainingUnits >= count) {
      this._remainingUnits -= count
    } else {
      throw new Error(`Not enough remaining units to consume (remaining: ${this._remainingUnits}, needed: ${count})`)
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
