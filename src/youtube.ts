import fetch from 'node-fetch';

interface YouTubeResponse {
	items: Array<{
		id: {
			videoId: string;
		};
		snippet: {
			title: string;
			description: string;
			channelTitle: string;
			publishedAt: string;
			thumbnails: {
				default: {
					url: string;
				};
				medium: {
					url: string;
				};
				high: {
					url: string;
				};
			};
		};
	}>;
}

export async function getLastVideo(channelID: string = process.env.YOUTUBE_CHANNEL!) {
	const apiKey = process.env.YOUTUBE_TOKEN;
	if (!apiKey) {
		throw Error('No YouTube API token provided.');
	}

	if (!process.env.YOUTUBE_CHANNEL) {
		throw Error('No YouTube channel ID provided.');
	}

	const url = `https://www.googleapis.com/youtube/v3/search?key=${apiKey}&channelId=${channelID}&part=snippet&order=date&maxResults=1`;
	const response = await fetch(url);

	if (!response.ok) {
		throw Error('Failed to fetch videos');
	}

	const data: YouTubeResponse = await response.json();

	const items = data.items;

	if (!items.length) {
		throw Error('No videos found for this channel.');
	}

	const {
		id: { videoId },
		snippet: { title, description, channelTitle, publishedAt, thumbnails }
	} = items[0];

	return {
		videoID: videoId,
		title,
		description,
		channelTitle,
		publishedAt,
		thumbnails
	};
}
