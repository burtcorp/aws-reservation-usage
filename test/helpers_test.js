const {describe, it} = require('mocha')
const {expect} = require('chai')
const helpers = require('../lib/helpers')

describe('helpers', function () {
  describe('#relativeSize', function () {
    it('returns 0.25 when given "nano"', function () {
      expect(helpers.relativeSize('nano')).to.equal(0.25)
    })

    it('returns 0.5 when given "micro"', function () {
      expect(helpers.relativeSize('micro')).to.equal(0.5)
    })

    it('returns 1 when given "small"', function () {
      expect(helpers.relativeSize('small')).to.equal(1)
    })

    it('returns 2, 4, 8 when given successively larger sizes', function () {
      expect(helpers.relativeSize('medium')).to.equal(2)
      expect(helpers.relativeSize('large')).to.equal(4)
      expect(helpers.relativeSize('xlarge')).to.equal(8)
    })

    it('returns 16, 32, 64 when given Nxlarge', function () {
      expect(helpers.relativeSize('2xlarge')).to.equal(16)
      expect(helpers.relativeSize('32xlarge')).to.equal(256)
    })

    it('returns 72 when given 9xlarge', function () {
      expect(helpers.relativeSize('9xlarge')).to.equal(72)
    })

    it('returns 144 when given 18xlarge', function () {
      expect(helpers.relativeSize('18xlarge')).to.equal(144)
    })

    it('raises an error when given something it does not expect', function () {
      expect(() => helpers.relativeSize('Nxlarge')).to.throw(/unsupported size: "Nxlarge"/i)
      expect(() => helpers.relativeSize('')).to.throw(/unsupported size: ""/i)
      expect(() => helpers.relativeSize(null)).to.throw(/unsupported size: "null"/i)
    })
  })
})
