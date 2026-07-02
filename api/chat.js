const { google } = require('googleapis');

// Google Sheets 설정
const sheets = google.sheets('v4');
const SHEET_ID = process.env.GOOGLE_SHEET_ID || '1Ml3iw6Hmi07HLYR87inmmQZUaw4FWwfh0MRG-Yu2xXw';
const AUTH_KEY = process.env.AUTH_KEY || 'SPoneteam';

let serviceAccountJson = process.env.GOOGLE_SERVICE_ACCOUNT;
let credentials = {};

if (serviceAccountJson) {
    try {
        credentials = JSON.parse(serviceAccountJson);
    } catch (e) {
        console.error('Failed to parse service account JSON');
    }
}

const auth = new google.auth.GoogleAuth({
    credentials: credentials,
    scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly']
});

// FAQ 캐시
let faqCache = null;
let cacheTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

async function getFAQData() {
    const now = Date.now();

    if (faqCache && (now - cacheTime) < CACHE_DURATION) {
        return faqCache;
    }

    try {
        const authClient = await auth.getClient();
        const response = await sheets.spreadsheets.values.get({
            auth: authClient,
            spreadsheetId: SHEET_ID,
            range: 'A:C'
        });

        const rows = response.data.values || [];
        const faq = [];

        for (let i = 1; i < rows.length; i++) {
            if (rows[i][0] && rows[i][1]) {
                faq.push({
                    question: rows[i][0],
                    answer: rows[i][1],
                    category: rows[i][2] || ''
                });
            }
        }

        faqCache = faq;
        cacheTime = now;
        return faq;
    } catch (error) {
        console.error('Google Sheets 오류:', error);
        return [];
    }
}

function calculateSimilarity(query, text) {
    query = query.toLowerCase().trim();
    text = text.toLowerCase().trim();

    if (text.includes(query)) return 100;

    const queryWords = query.split(/\s+/);
    const textWords = text.split(/\s+/);

    let matchCount = 0;
    for (const qWord of queryWords) {
        if (textWords.some(tWord => tWord.includes(qWord))) {
            matchCount++;
        }
    }

    return (matchCount / queryWords.length) * 100;
}

function searchFAQ(query, faq) {
    let bestMatch = null;
    let bestScore = 30;

    for (const item of faq) {
        const score = calculateSimilarity(query, item.question);

        if (score > bestScore) {
            bestScore = score;
            bestMatch = item;
        }
    }

    return bestMatch;
}

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
    res.setHeader(
        'Access-Control-Allow-Headers',
        'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
    );

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
    }

    try {
        const { message, authKey } = req.body;

        if (authKey !== AUTH_KEY) {
            return res.status(401).json({
                authenticated: false,
                success: false,
                message: '인증 실패'
            });
        }

        if (message === 'AUTH_CHECK') {
            return res.status(200).json({ authenticated: true });
        }

        const faq = await getFAQData();

        if (faq.length === 0) {
            return res.status(500).json({
                success: false,
                message: 'FAQ 데이터를 불러올 수 없습니다'
            });
        }

        const match = searchFAQ(message, faq);

        if (match) {
            return res.status(200).json({
                success: true,
                answer: match.answer,
                category: match.category
            });
        } else {
            return res.status(200).json({
                success: false,
                message: '관련된 FAQ를 찾을 수 없습니다. 다른 질문을 시도해보세요.'
            });
        }
    } catch (error) {
        console.error('API 오류:', error);
        return res.status(500).json({
            success: false,
            message: '서버 오류가 발생했습니다'
        });
    }
};
