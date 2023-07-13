// https://www.mediawiki.org/wiki/API:Tokens#JavaScript
// https://www.mediawiki.org/wiki/API:Edit#MediaWiki_JS
// https://www.w3.org/wiki/api.php?action=help&modules=edit

import 'source-map-support/register';
import 'dotenv/config';

import { inspect } from 'util';
import { join } from 'path';
import { readFile } from 'fs/promises';
import { render } from 'ejs';
import nodeFetch, { Headers, Response } from 'node-fetch';
import fetchCookie from 'fetch-cookie';
import { JSDOM } from 'jsdom';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const fetch = fetchCookie(nodeFetch) as any; // TODO: For some reason doesn't like headers
const domain = process.env.DOMAIN;
const url = `https://${domain}/api.php`;
const pageTitle = 'Main Page';
const headers = new Headers({
	'Content-Type': 'application/x-www-form-urlencoded'
});

if (!process.env.BOT_USERNAME) {
	throw new Error('BOT_USERNAME env variable not set');
}

if (!process.env.BOT_PASSWORD) {
	throw new Error('BOT_PASSWORD env variable not set');
}

async function getToken() {
	// Get login token
	let params = new URLSearchParams({
		action: 'query',
		meta: 'tokens',
		type: 'login',
		format: 'json'
	});

	let response = (await fetch(`${url}?${params}`)) as Response;
	let body = await response.json();
	// const cookies = response.headers.get('set-cookie').split(';')[0];

	if (body.error) throw body.error.info;
	const loginToken = body.query.tokens.logintoken;

	// Post request to login
	params = new URLSearchParams({
		action: 'login',
		lgname: process.env.BOT_USERNAME!,
		lgpassword: process.env.BOT_PASSWORD!,
		lgtoken: loginToken,
		format: 'json'
	});

	response = await fetch(url, {
		method: 'POST',
		headers,
		body: params
	});

	const errorHeader = response.headers.get('MediaWiki-API-Error');
	if (errorHeader) throw errorHeader;

	body = await response.json();
	if (body.login.result !== 'Success') throw body.login.reason;

	params = new URLSearchParams({
		action: 'query',
		meta: 'tokens',
		format: 'json'
	});

	response = await fetch(`${url}?${params}`);
	body = await response.json();

	const csrfToken = body.query.tokens.csrftoken;

	return csrfToken;
}

async function getPage(pageTitle: string) {
	const params = new URLSearchParams({
		action: 'query',
		titles: pageTitle,
		prop: 'revisions',
		rvprop: 'content',
		format: 'json'
	});

	const response = await fetch(`${url}?${params}`)
		.then((r: Response) => r.json())
		.catch((err) => console.error(err));

	const pageId = Object.keys(response.query.pages)[0];
	const raw = response.query.pages[pageId].revisions[0]['*'];

	return raw;
}

async function renderLocalHTML(data) {
	const path = join(__dirname, '..', 'assets', 'socials.html');
	const file = await readFile(path, 'utf-8');
	const html = render(file, data);
	return html;
}

async function updateSocials(pageHtml: string, newInnerHtml: string) {
	const dom = new JSDOM(pageHtml);
	const socialsDiv = dom.window.document.querySelector('#socials');

	if (socialsDiv) {
		socialsDiv.innerHTML = newInnerHtml;
		return dom.window.document.querySelector('body').innerHTML;
	}

	throw new Error('Could not find element with id "socials"');
}

async function editPage(token: string, pageTitle: string, newContent: string) {
	const params = new URLSearchParams({
		action: 'edit',
		title: pageTitle,
		text: newContent,
		token,
		format: 'json'
	});

	const response = await fetch(url, {
		method: 'POST',
		body: params
	})
		.then((r: Response) => r.json())
		.catch((err) => console.error(err));

	return response;
}

(async () => {
	const token = await getToken();
	const oldPageHTML = await getPage(pageTitle);

	// TODO: This is test data to avoid using the Youtube API
	const data = {
		youtubeThumbnail: 'https://i.ytimg.com/vi/CJ3hfxxlF2Q/maxresdefault.jpg',
		youtubeTitle: 'Progressive Victory All Hands Q2',
		youtubeDescription:
			'📢Join us for this Quarter\'s All Hands Meeting!📢\nCome hear about all things PV! \nStay up to date with recent changes and updates.  \nLearn all the rad new ways to get involved  \nhttps://www.mobilize.us/progressivevi...\nVideo/Music by: PV Video Team\nVoice Over by:\nJoin our efforts and come volunteer with Progressive Victory!\nhttps://progressivevictory.win/volunteer\n\nWebsite: https://progressivevictory.win/video',
		youtubeLink: 'https://www.youtube.com/watch?v=zc1vYezduZQ',
		youtubeChannelTitle: 'Progressive Victory',
		youtubeVideoID: 'CJ3hfxxlF2Q'
	};

	const newSnippet = await renderLocalHTML(data);
	const newPageHtml = await updateSocials(oldPageHTML, newSnippet);
	const editResponse = await editPage(token, pageTitle, newPageHtml);

	return editResponse;
})()
	.then((o) => console.log(inspect(o, false, null, true)))
	.catch((e) => console.error(inspect(e, false, null, true)));

process.on('unhandledRejection', (err) => {
	console.error(err);
});
