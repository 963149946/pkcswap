"use strict";
describe('Migrate V1 Liquidity', function () {
    describe('Remove V1 liquidity', function () {
        it('renders the correct page', function () {
            cy.visit('/remove/v1/0x93bB63aFe1E0180d0eF100D774B473034fd60C36');
            cy.get('#remove-v1-exchange').should('contain', 'MKR/ETH');
        });
    });
});
