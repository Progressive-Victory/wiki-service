import fetch from 'node-fetch';
import { promises as fs } from 'fs';
import { join } from 'path';

const CONFIG_PATH = join(__dirname, '..', 'config.json');
const BASE = 'https://graph.instagram.com';

interface Config {
	accessToken: string;
	creationTime?: number;
}

interface InstagramPost {
	name: string;
	image?: string;
	link: string;
	description: string;
	video?: string;
	type: string;
}

interface UserProfile {
	username: string;
	picture: string;
}

export default async function getLastInstagramPost(): Promise<InstagramPost> {
	let config: Config;

	try {
		const rawConfig = await fs.readFile(CONFIG_PATH);
		config = JSON.parse(rawConfig.toString());
	} catch {
		throw new Error('Config file does not exist or is invalid.');
	}

	// If creationTime doesn't exist, set it to now
	if (!config.creationTime) {
		config.creationTime = Date.now();
		await fs.writeFile(CONFIG_PATH, JSON.stringify(config));
		await fs.copyFile(CONFIG_PATH, join(__dirname, '..', 'config.json'));
	}

	// Check if the token is expired
	const tokenAge = Date.now() - config.creationTime;
	const tokenAgeDays = tokenAge / 1000 / 60 / 60 / 24;

	if (tokenAgeDays >= 60) {
		// If the token is older than 60 days, we need to refresh it
		config = await refreshAccessToken(config.accessToken);
	}

	// Fetch user profile
	const userProfile = await fetchUserProfile(config.accessToken);

	// Fetch most recent post
	const response = await fetch(
		`${BASE}/me/media?fields=id,caption,permalink,media_type,media_url,thumbnail_url&access_token=${config.accessToken}`
	);
	const data = await response.json();

	const recentPost = data.data.find((post: any) => post.media_type === 'IMAGE');
	if (!recentPost) {
		throw new Error('Could not find any recent image posts.');
	}

	return {
		name: userProfile.username,
		video: recentPost.media_url, // TODO: IG doesn't seem to support embedding, hit 403
		image: recentPost.thumbnail_url,
		link: recentPost.permalink || `https://www.instagram.com/p/${recentPost.id}/`,
		description: recentPost.caption,
		type: recentPost.media_type
	};
}

async function fetchUserProfile(accessToken: string): Promise<UserProfile> {
	const response = await fetch(`${BASE}/me?fields=username,profile_picture_url&access_token=${accessToken}`);
	const data = await response.json();

	return {
		username: data.username,
		picture: data.profile_picture_url
	};
}

async function refreshAccessToken(accessToken: string): Promise<Config> {
	const response = await fetch(
		`${BASE}/refresh_access_token?grant_type=ig_refresh_token&access_token=${accessToken}`
	);
	const data = await response.json();

	const newAccessToken = data.access_token;
	const newConfig: Config = {
		accessToken: newAccessToken,
		creationTime: Date.now()
	};

	// Store refreshed token and its creation time in a local file
	await fs.writeFile(CONFIG_PATH, JSON.stringify(newConfig));

	return newConfig;
}
