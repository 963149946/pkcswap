"use strict";
describe('Remove Liquidity', function () {
    it('redirects', function () {
        cy.visit('/remove/0xc778417E063141139Fce010982780140Aa0cD5Ab-0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85');
        cy.url().should('contain', '/remove/0xc778417E063141139Fce010982780140Aa0cD5Ab/0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85');
    });
    it('eth remove', function () {
        cy.visit('/remove/ETH/0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85');
        cy.get('#remove-liquidity-tokena-symbol').should('contain.text', 'HT');
        cy.get('#remove-liquidity-tokenb-symbol').should('contain.text', 'MKR');
    });
    it('eth remove swap order', function () {
        cy.visit('/remove/0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85/ETH');
        cy.get('#remove-liquidity-tokena-symbol').should('contain.text', 'MKR');
        cy.get('#remove-liquidity-tokenb-symbol').should('contain.text', 'HT');
    });
    it('loads the two correct tokens', function () {
        cy.visit('/remove/0xc778417E063141139Fce010982780140Aa0cD5Ab-0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85');
        cy.get('#remove-liquidity-tokena-symbol').should('contain.text', 'WHT');
        cy.get('#remove-liquidity-tokenb-symbol').should('contain.text', 'MKR');
    });
    it('does not crash if ETH is duplicated', function () {
        cy.visit('/remove/0xc778417E063141139Fce010982780140Aa0cD5Ab-0xc778417E063141139Fce010982780140Aa0cD5Ab');
        cy.get('#remove-liquidity-tokena-symbol').should('contain.text', 'WHT');
        cy.get('#remove-liquidity-tokenb-symbol').should('contain.text', 'WHT');
    });
    it('token not in storage is loaded', function () {
        cy.visit('/remove/0xb290b2f9f8f108d03ff2af3ac5c8de6de31cdf6d-0xF9bA5210F91D0474bd1e1DcDAeC4C58E359AaD85');
        cy.get('#remove-liquidity-tokena-symbol').should('contain.text', 'SKL');
        cy.get('#remove-liquidity-tokenb-symbol').should('contain.text', 'MKR');
    });
});
