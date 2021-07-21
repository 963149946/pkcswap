"use strict";
describe('Pool', function () {
    beforeEach(function () { return cy.visit('/pool'); });
    it('add liquidity links to /add/ETH', function () {
        cy.get('#join-pool-button').click();
        cy.url().should('contain', '/add/ETH');
    });
    it('import pool links to /import', function () {
        cy.get('#import-pool-link').click();
        cy.url().should('contain', '/find');
    });
});
