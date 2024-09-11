'use strict';

const { JWT } = require('google-auth-library');
// eslint-disable-next-line camelcase
const { drive_v3 } = require('@googleapis/drive');
const cheerio = require('cheerio');
const Handlebars = require('handlebars');
const { convert } = require('html-to-text');

const fs = require('fs');
const path = require('path');
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
 * @prop {string[]} to
 * @prop {string[]} cc
 * @prop {string[]} bcc
 * @prop {string} subject
 * @prop {string} messagePlainText
 * @prop {string} messageHtml
 */

/**
 * Google sheets storage for test cases
 */

Handlebars.registerHelper('gt', (a, b) => a > b);

Handlebars.registerHelper('createLink', (url, text) => new Handlebars.SafeString(`<a href="${url}">${text}</a>`));

Handlebars.registerHelper('smallHtmlTag', (text) => new Handlebars.SafeString(`<small>${text}</small>`));
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
        // eslint-disable-next-line camelcase
        this._googleDrive = new drive_v3.Drive({ auth });
        this._docId = docId;
        this._googleToken = googleToken;
        this._$ = null;
        this._htmlToTextConverterOptions = {
            wordwrap: false
        };
        this._subdirectory = path.join(process.cwd(), 'mail_templates');

        this._filePath = path.join(this._subdirectory, `${this._docId}.html`);
    }

    async downloadMailTemplate () {

        const htmlRes = await this._googleDrive.files.export({
            fileId: this._docId,
            mimeType: 'text/html'
        });

        /** @type {string} */
        // @ts-ignore
        const html = htmlRes.data;

        if (!fs.existsSync(this._subdirectory)) {
            fs.mkdirSync(this._subdirectory);
        }

        // Save the HTML content to a file
        // @ts-ignore
        fs.writeFileSync(this._filePath, html, (err) => {
            if (err) {
                throw new Error(`Error saving mail template: ${err.message}`);
            }
        });
        return this._filePath;
    }

    /**
     * @param {('cs'|'en'|'sk'|'pl'|'de')} locale
     * @param {object} dataForHandlebarsTemplating
     * @returns {Promise<MailData>}
     */
    async getMailData (locale, dataForHandlebarsTemplating) {

        const html = fs.readFileSync(this._filePath, 'utf8');

        this._$ = cheerio.load(html);
        // Define the template strings
        const to = this._findValueByKey('Komu')?.split(',')?.map((address) => address?.trim()?.toLowerCase());
        const cc = this._findValueByKey('Kopie')?.split(',')?.map((address) => address?.trim()?.toLowerCase());
        const bcc = this._findValueByKey('Skrytá kopie')?.split(',')?.map((address) => address?.trim()?.toLowerCase());
        const subjectTemplate = this._findValueByKey(`Předmět ${locale}`);
        const messageHtmlTemplate = `${this._findValueByKey(`Zpráva ${locale}`, true)}`;
        const subject = Handlebars.compile(subjectTemplate)(dataForHandlebarsTemplating);
        const messageHtml = this.stripStylesExceptFontWeight(
            Handlebars.compile(messageHtmlTemplate)(dataForHandlebarsTemplating)
        );
        // @ts-ignore
        const messagePlainText = convert(messageHtml, this._htmlToTextConverterOptions);

        return {
            to, cc, bcc, subject, messagePlainText, messageHtml
        };
    }

    /**
     * Function to strip away all style information except font-weight.
     *
     * @param {string} html - The HTML string to process.
     * @returns {string} - The processed HTML string.
     */
    stripStylesExceptFontWeight (html) {
        const $ = cheerio.load(html);

        $('[style]').each((index, element) => {
            const style = $(element).attr('style');
            const allowedStyles = style.match(/(font-weight\s*:\s*[^;]+|text-decoration\s*:\s*[^;]+|font-style\s*:\s*[^;]+|color\s*:\s*[^;]+)/gi);
            const newStyle = allowedStyles ? allowedStyles.join('; ') : '';
            $(element).attr('style', newStyle);
        });

        // Convert empty <p><span></span></p> to <br>
        $('p').each((index, element) => {
            const $element = $(element);
            const $span = $element.find('span');
            if ($span.length === 1 && !$span.text().trim()) {
                $element.replaceWith('<br>');
            }
        });

        return $.html();
    }

    /**
     * Function to find the value in the second column for a given key in the first column.
     * If the row has only one column, the value is in the next row with a single column.
     *
     * @param {string} key - The key to search for in the first column.
     * @param {boolean} [returnHtml=false] - Whether to return the inner HTML instead of text.
     * @param {boolean} withNewLines
     * @returns {string|null} - The value in the second column, or null if the key is not found.
     */
    _findValueByKey (key, returnHtml = false, withNewLines = false) {
        let value = null;
        // eslint-disable-next-line consistent-return
        this._$('table tr').each((index, element) => {
            const firstColumnText = this._$(element).find('td').eq(0).text()
                .trim();
            const secondColumn = this._$(element).find('td').eq(1);

            // console.log(key, firstColumnText)

            if (firstColumnText === key) {
                if (secondColumn.length > 0) {
                    // @ts-ignore
                    if (returnHtml) {
                        value = secondColumn.html().trim();
                    } else if (withNewLines) {
                        // @ts-ignore
                        value = convert(secondColumn.html(), this._htmlToTextConverterOptions);
                    } else {
                        value = secondColumn.text().trim();
                    }
                } else {
                    const nextRow = this._$('table tr').eq(index + 1);
                    const nextRowSingleColumn = nextRow.find('td').eq(0);
                    if (nextRowSingleColumn.length === 1) {

                        if (returnHtml) {
                            value = nextRowSingleColumn.html().trim();
                        } else if (withNewLines) {
                            value = convert(
                                nextRowSingleColumn.html(),
                                // @ts-ignore
                                this._htmlToTextConverterOptions
                            );
                        } else {
                            value = nextRowSingleColumn.text().trim();
                        }
                    }
                }
                return false; // breaks cycle
            }
            return true;
        });
        return value;
    }
}

module.exports = MailGoogleDoc;
