"use strict";
describe('Send', function () {
    it('should redirect', function () {
        cy.visit('/send');
        cy.url().should('include', '/swap');
    });
    it('should redirect with url params', function () {
        cy.visit('/send?outputCurrency=ETH&recipient=bob.argent.xyz');
        cy.url().should('contain', '/swap?outputCurrency=ETH&recipient=bob.argent.xyz');
    });
});
