'use strict';

// const assert = require('assert');
const { MailGoogleDoc } = require('../src/main');
// @ts-ignore
const googleToken = require('../google-token.json');

const GDOC_ID = 'enter_gdoc_id';

describe('<MailsGdocs>', () => {

    describe('#getTestCases()', () => {

        it.skip('works', async () => {

            const mailGoogleDoc = new MailGoogleDoc(GDOC_ID, googleToken);

            const { messagePlainText } = await mailGoogleDoc.getMailData('cs');

        });

    });

});
