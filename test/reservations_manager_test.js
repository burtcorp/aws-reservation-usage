const {describe, it, beforeEach} = require('mocha')
const {expect} = require('chai')
const ReservationManager = require('../lib/reservation_manager')

require('mocha-define') /* global def */

describe('ReservationManager', function () {
  def('reservationManager', function () {
    return new ReservationManager(this.reservations)
  })

  beforeEach(function () {
    this.reservations = []
  })

  beforeEach(function () {
    this.instance = {
      family: 'i9',
      size: 'large',
      az: 'eu-north-9g',
      units: 4,
    }
  })

  describe('#constructor', function () {
    it('does not mutate the reservation objects passed to it', function () {
      const reservation = {family: 'i9', size: 'large', offeringClass: 'standard', az: 'eu-north-9g', units: 8}
      new ReservationManager([reservation])
      expect(reservation.family).to.equal('i9')
      expect(reservation.size).to.equal('large')
      expect(reservation.offeringClass).to.equal('standard')
      expect(reservation.az).to.equal('eu-north-9g')
      expect(reservation.units).to.equal(8)
      expect(reservation.remainingUnits).to.be.undefined
    })
  })

  describe('#unusedReservedCapacity', function () {
    beforeEach(function () {
      this.reservations.push({family: 'i9', size: 'large', offeringClass: 'standard', az: 'eu-north-9g', units: 8})
      this.reservations.push({family: 'p99', size: 'small', offeringClass: 'standard', az: '*', units: 7})
      this.reservations.push({family: 'i9', size: 'medium', offeringClass: 'standard', az: '*', units: 2})
      this.reservations.push({family: 'i9', size: 'large', offeringClass: 'standard', az: '*', units: 8})
    })

    it('returns reservations that have remaining capacity', function () {
      expect(this.reservationManager.unusedReservedCapacity().length).to.equal(4)
      this.reservationManager.consumeReservedCapacity(this.instance)
      expect(this.reservationManager.unusedReservedCapacity().length).to.equal(4)
      this.reservationManager.consumeReservedCapacity(this.instance)
      expect(this.reservationManager.unusedReservedCapacity().length).to.equal(3)
      expect(this.reservationManager.unusedReservedCapacity().find(r => r.family === 'i9' && r.offeringClass == 'standard' && r.size == 'large' && r.az == '*')).to.not.be.undefined
      expect(this.reservationManager.unusedReservedCapacity().find(r => r.family === 'i9' && r.offeringClass == 'standard' && r.size == 'large' && r.az == 'eu-north-9g')).to.be.undefined
    })
  })

  describe('#consumeReservedCapacity', function () {
    beforeEach(function () {
      this.findUnusedReservedCapacity = function (properties) {
        return this.reservationManager.unusedReservedCapacity().find((r) => {
          return r.family == properties.family
            && r.size == properties.size
            && r.offeringClass == properties.offeringClass
            && r.az == properties.az
            && r.units == properties.units
        })
      }
    })

    describe('when there are no reservations', function () {
      it('returns null', function () {
        expect(this.reservationManager.consumeReservedCapacity(this.instance)).to.be.null
      })
    })

    describe('when a matching reservation is found', function () {
      beforeEach(function () {
        this.reservations.push({family: 'i9', size: 'large', offeringClass: 'standard', az: 'eu-north-9g', units: 8})
      })

      it('returns that reservation', function () {
        const reservation = this.reservationManager.consumeReservedCapacity(this.instance)
        expect(reservation.family).to.equal('i9')
        expect(reservation.size).to.equal('large')
        expect(reservation.offeringClass).to.equal('standard')
        expect(reservation.az).to.equal('eu-north-9g')
        expect(reservation.units).to.equal(8)
      })

      it('decrements the number of remaining units of the reservation', function () {
        const reservation = this.reservationManager.consumeReservedCapacity(this.instance)
        expect(reservation.remainingUnits).to.equal(reservation.units - this.instance.units)
      })
    })

    describe('when there exists an az-specific standard reservation with a matching family and size', function () {
      beforeEach(function () {
        this.reservations.push({family: 'p99', size: 'small', offeringClass: 'standard', az: 'eu-north-9g', units: 7})
        this.reservations.push({family: 'i9', size: 'large', offeringClass: 'standard', az: 'eu-north-9g', units: 8})
        this.reservations.push({family: 'i9', size: 'medium', offeringClass: 'standard', az: 'eu-north-9g', units: 2})
      })

      it('consumes capacity from that reservation', function () {
        this.reservationManager.consumeReservedCapacity(this.instance)
        expect(this.findUnusedReservedCapacity(this.reservations[1]).remainingUnits).to.equal(this.reservations[1].units - this.instance.units)
      })

      describe('but also a region-wide standard reservation for the same family and size', function () {
        beforeEach(function () {
          this.reservations.unshift({family: 'i9', size: 'large', offeringClass: 'standard', az: '*', units: 8})
        })

        it('consumes capacity from the az-specific reservation', function () {
          this.reservationManager.consumeReservedCapacity(this.instance)
          expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units - this.instance.units)
        })

        describe('and the az-specific reservation has too few remaining units', function () {
          beforeEach(function () {
            this.reservations[2].units = 3
          })

          it('consumes from the region-wide reservation', function () {
            this.reservationManager.consumeReservedCapacity(this.instance)
            expect(this.findUnusedReservedCapacity(this.reservations[0]).remainingUnits).to.equal(this.reservations[0].units - this.instance.units)
          })
        })
      })

      describe('but also a convertible reservation for the same family and size', function () {
        beforeEach(function () {
          this.reservations.unshift({family: 'i9', size: 'large', offeringClass: 'convertible', az: '*', units: 8})
        })

        it('returns the standard reservation', function () {
          this.reservationManager.consumeReservedCapacity(this.instance)
          expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units - this.instance.units)
        })

        describe('and the standard reservation has too few remaining units', function () {
          beforeEach(function () {
            this.reservations[2].units = 3
          })

          it('consumes from the convertible reservation', function () {
            this.reservationManager.consumeReservedCapacity(this.instance)
            expect(this.findUnusedReservedCapacity(this.reservations[0]).remainingUnits).to.equal(this.reservations[0].units - this.instance.units)
          })
        })
      })

      describe('but that reservation has too few remaining units', function () {
        beforeEach(function () {
          this.reservations[1].units = 2
        })

        it('returns null', function () {
          expect(this.reservationManager.consumeReservedCapacity(this.instance)).to.be.null
        })

        it('consumes from no reservation', function () {
          expect(this.findUnusedReservedCapacity(this.reservations[0]).remainingUnits).to.equal(this.reservations[0].units)
          expect(this.findUnusedReservedCapacity(this.reservations[1]).remainingUnits).to.equal(this.reservations[1].units)
          expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units)
        })
      })
    })

    describe('when there exists a region-wide standard reservation for the same family and size', function () {
      beforeEach(function () {
        this.reservations.push({family: 'p99', size: 'small', offeringClass: 'standard', az: '*', units: 7})
        this.reservations.push({family: 'i9', size: 'medium', offeringClass: 'standard', az: '*', units: 2})
        this.reservations.push({family: 'i9', size: 'large', offeringClass: 'standard', az: '*', units: 8})
      })

      it('consumes from that reservation', function () {
        this.reservationManager.consumeReservedCapacity(this.instance)
        expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units - this.instance.units)
      })
    })

    describe('when there exists a region-wide standard reservation for the same family but different size', function () {
      beforeEach(function () {
        this.reservations.push({family: 'p99', size: 'small', offeringClass: 'standard', az: '*', units: 7})
        this.reservations.push({family: 'i9', size: 'medium', offeringClass: 'standard', az: '*', units: 2})
        this.reservations.push({family: 'i9', size: 'xlarge', offeringClass: 'standard', az: '*', units: 8})
      })

      it('consumes from that reservation', function () {
        this.reservationManager.consumeReservedCapacity(this.instance)
        expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units - this.instance.units)
      })
    })

    describe('when there exists a convertible reservation for the same family and size', function () {
      beforeEach(function () {
        this.reservations.push({family: 'p99', size: 'small', offeringClass: 'convertible', az: '*', units: 7})
        this.reservations.push({family: 'i9', size: 'large', offeringClass: 'convertible', az: '*', units: 8})
        this.reservations.push({family: 'm7', size: 'medium', offeringClass: 'convertible', az: '*', units: 2})
      })

      it('consumes from that reservation', function () {
        this.reservationManager.consumeReservedCapacity(this.instance)
        expect(this.findUnusedReservedCapacity(this.reservations[1]).remainingUnits).to.equal(this.reservations[1].units - this.instance.units)
      })

      describe('but also a convertible reservation for the same family but another size', function () {
        beforeEach(function () {
          this.reservations.unshift({family: 'i9', size: 'medium', offeringClass: 'convertible', az: '*', units: 100})
        })

        it('returns the reservation with the same size', function () {
          this.reservationManager.consumeReservedCapacity(this.instance)
          expect(this.findUnusedReservedCapacity(this.reservations[2]).remainingUnits).to.equal(this.reservations[2].units - this.instance.units)
        })

        describe('and the reservation with the same size has too few remaining units', function () {
          beforeEach(function () {
            this.reservations[2].units = 3
          })

          it('consumes from the reservation of the other size', function () {
            this.reservationManager.consumeReservedCapacity(this.instance)
            expect(this.findUnusedReservedCapacity(this.reservations[0]).remainingUnits).to.equal(this.reservations[0].units - this.instance.units)
          })
        })
      })
    })
  })
})
