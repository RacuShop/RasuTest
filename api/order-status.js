/**
 * Vercel serverless function: Order status endpoint
 * Returns the current order status for a Telegram user
 * Searches WEEEK CRM tasks by Telegram ID
 *
 * Environment variable required: WEEEK_API_TOKEN
 */

export default async function handler(req, res) {
    // Only accept GET requests
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        const { telegramId } = req.query;

        // Validate required fields
        if (!telegramId) {
            return res.status(400).json({ error: 'Missing telegramId parameter' });
        }

        // Validate WEEEK API token
        if (!process.env.WEEEK_API_TOKEN) {
            console.error('WEEEK_API_TOKEN is not set in environment variables');
            return res.status(500).json({
                error: 'Server configuration error',
                message: 'WEEEK API token not configured',
            });
        }

        console.log('Searching for orders for Telegram ID:', telegramId);

        // Call WEEEK API to get tasks
        // First, get all tasks from the project
        const weeekResponse = await fetch(`https://api.weeek.net/public/v1/tm/tasks?projectId=2`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${process.env.WEEEK_API_TOKEN}`,
                'Content-Type': 'application/json',
            },
        });

        let responseData;
        try {
            const text = await weeekResponse.text();
            responseData = text ? JSON.parse(text) : {};
        } catch (e) {
            console.error('Failed to parse WEEEK response:', e);
            responseData = { error: 'Invalid JSON response from WEEEK' };
        }

        console.log('WEEEK response status:', weeekResponse.status);
        console.log('WEEEK response data:', responseData);

        // Handle authentication errors
        if (weeekResponse.status === 401) {
            console.error('WEEEK authentication failed - invalid token');
            return res.status(401).json({
                error: 'Authentication failed',
                message: 'WEEEK API token is invalid or expired',
            });
        }

        if (!weeekResponse.ok) {
            console.error('WEEEK API error:', {
                status: weeekResponse.status,
                statusText: weeekResponse.statusText,
                data: responseData,
            });

            return res.status(weeekResponse.status).json({
                error: 'Failed to fetch tasks from WEEEK CRM',
                details: responseData,
            });
        }

        // Find tasks that contain this Telegram ID
        const tasks = responseData?.data || responseData || [];
        console.log('Found tasks:', tasks.length);

        // Search for tasks containing the Telegram ID
        const userTasks = tasks.filter(task => {
            const description = task.description || '';
            return description.includes(`Telegram ID: ${telegramId}`);
        });

        console.log('User tasks found:', userTasks.length);

        if (userTasks.length === 0) {
            return res.status(200).json({
                hasOrder: false,
            });
        }

        // Get the most recent task (assuming tasks are ordered by creation date)
        const latestTask = userTasks[0];

        // Extract status from the task
        // In WEEEK, status is usually in the column name or status field
        let status = 'Неизвестен';

        if (latestTask.columnName) {
            status = latestTask.columnName;
        } else if (latestTask.status) {
            status = latestTask.status;
        } else if (latestTask.column) {
            status = latestTask.column.name || latestTask.column.title || 'В работе';
        }

        console.log('Order status found:', status);

        return res.status(200).json({
            hasOrder: true,
            status: status,
            taskId: latestTask.id,
        });

    } catch (error) {
        console.error('Order status error:', {
            message: error.message,
            stack: error.stack,
            type: error.constructor.name,
        });
        return res.status(500).json({
            error: 'Internal server error',
            message: error.message,
        });
    }
}