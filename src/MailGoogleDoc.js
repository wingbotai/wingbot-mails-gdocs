/**
 * @author David Menger
 */
'use strict';

const { JWT } = require('google-auth-library');
const { drive_v3 } = require('@googleapis/drive');
const cheerio = require('cheerio');

/**
 * @typedef {object} TestCaseStep
 * @prop {number} step
 * @prop {number} rowNum
 * @prop {string} action
 * @prop {string} passedAction
 * @prop {string} textContains
 * @prop {string} quickRepliesContains
 * @prop {string} stepDescription
 */

/**
 * @typedef {object} TestCase
 * @prop {string} list
 * @prop {string} name
 * @prop {TestCaseStep[]} steps
 */

/**
 * @typedef {object} GoogleJSONToken
 * @prop {string} client_email
 * @prop {string} private_key
 */

/**
 * @typedef {object} MailData
 * @prop {string} to
 * @prop {string} cc
 * @prop {string} bcc
 * @prop {string} subject
 * @prop {string} messagePlainText
 * @prop {string} messageHtml
 */

/**
 * Google sheets storage for test cases
 */
class MailGoogleDoc {

    /**
     *
     * @param {string} docId
     * @param {GoogleJSONToken} [googleToken]
     */
    constructor (docId, googleToken = null) {
        const auth = new JWT({
            email: googleToken.client_email,
            key: googleToken.private_key,
            scopes: [
                'https://www.googleapis.com/auth/drive.readonly'
            ]
        });
        this._googleDrive = new drive_v3.Drive({ auth });
        this._docId = docId
        this._googleToken = googleToken;
        this._$ = null;
    }

    /**
     *
     * @returns {Promise<MailData>}
     */
   async getMailData()
   {
    const htmlRes = await this._googleDrive.files.export({
        fileId: this._docId,
        mimeType: 'text/html'
    });

    /** @type {string} */
    // @ts-ignore
    const html =  htmlRes.data;

    this._$ = cheerio.load(html);
    const to = this._getTo()
    const cc = this._getCc()

    const bcc = this._getBcc()
    const subject = this._getSubject()
    const messagePlainText = this._getMessagePlainText()
    const messageHtml = this._getMessageHtml()

    return {to, cc, bcc, subject, messagePlainText, messageHtml}

   }
    _getCellContent( rowIndex, cellIndex, html = false) {
        const row = this._$('table tr').eq(rowIndex);
        const cell = row.find('td').eq(cellIndex);
        if(html)
            return cell.html();
        else
            return cell.text();
    }

    _getTo() {
        return this._getCellContent(0, 1)
    }

    _getCc() {
        return this._getCellContent(1, 1)
    }

    _getBcc() {
        return this._getCellContent(2, 1)
    }

    _getSubject() {
        return this._getCellContent(3, 1)
    }

    _getMessagePlainText() {
        return this._getCellContent(4, 0)
    }

    _getMessageHtml() {
        return this._getCellContent(4, 0, true)
    }
    
}


module.exports = MailGoogleDoc;
