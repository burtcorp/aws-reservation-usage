const {describe, it, beforeEach} = require('mocha')
const {expect} = require('chai')
const Summarizer = require('../lib/summarizer')

require('mocha-define') /* global def */

describe('Summarizer', function () {
  def('summarizer', function () {
    return new Summarizer(this.reservations, this.instances)
  })

  def('summary', function () {
    return this.summarizer.summarize()
  })

  beforeEach(function () {
    this.reservations = []
    this.instances = []
  })

  describe('#summarize', function () {
    beforeEach(function () {
      this.instances.push({family: 'i9', size: 'large', units: 4, spot: false, emr: false})
      this.instances.push({family: 'p7', size: 'large', units: 4, spot: false, emr: false})
      this.instances.push({family: 'd5', size: 'large', units: 4, spot: false, emr: false})
      this.instances.push({family: 'c6', size: 'large', units: 4, spot: true, emr: false})
      this.instances.push({family: 'i9', size: 'large', units: 4, spot: false, emr: true})
      this.reservations.push({family: 'p7', size: 'small', offeringClass: 'convertible', units: 8})
      this.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 18})
      this.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 4})
      this.reservations.push({family: 'i9', size: 'small', offeringClass: 'convertible', units: 2})
    })

    describe('returns a summary that', function () {
      it('contains the families of the instances and reservations, in alphabetical order', function () {
        expect(this.summary.map(s => s.family)).to.deep.equal([
          'c6',
          'd5',
          'i9',
          'p7',
        ])
      })

      it('contains the the number of running on demand units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.onDemand])).to.deep.equal([
          ['c6', 0],
          ['d5', 4],
          ['i9', 4],
          ['p7', 4],
        ])
      })

      it('contains the the number of running spot units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.spot])).to.deep.equal([
          ['c6', 4],
          ['d5', 0],
          ['i9', 0],
          ['p7', 0],
        ])
      })

      it('contains the the number of running EMR units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.emr])).to.deep.equal([
          ['c6', 0],
          ['d5', 0],
          ['i9', 4],
          ['p7', 0],
        ])
      })

      it('contains the the number of reserved units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.reserved])).to.deep.equal([
          ['c6', 0],
          ['d5', 0],
          ['i9', 18 + 4 + 2],
          ['p7', 8],
        ])
      })

      it('contains the the number of unreserved units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.unreserved])).to.deep.equal([
          ['c6', 0],
          ['d5', 4],
          ['i9', 0],
          ['p7', 0],
        ])
      })

      it('contains the the number of unused reserved units for each instance family', function () {
        expect(this.summary.map(s => [s.family, s.surplus])).to.deep.equal([
          ['c6', 0],
          ['d5', 0],
          ['i9', 18 + 4 + 2 - 4 - 4],
          ['p7', 8 - 4],
        ])
      })
    })
  })
})
