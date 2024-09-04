/*
 * @author David Menger
 */
'use strict';

// const assert = require('assert');
const { MailGoogleDoc } = require('../src/main');
// @ts-ignore
const googleToken = require('../google-token.json');

describe('<MailsGdocs>', function () {

    describe('#getTestCases()', () => {

        it('works', async () => {

            const mailGoogleDoc = new MailGoogleDoc('1kkJfEA5XT0NhDPZpQaGSVKg8r6NlOKoK3LECT-lfAp0', googleToken);

            await mailGoogleDoc.getMailData();

        });

    });

});
