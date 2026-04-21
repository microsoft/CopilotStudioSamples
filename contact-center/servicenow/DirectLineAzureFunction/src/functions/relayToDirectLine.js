const { app } = require('@azure/functions');
const request = require('request-promise');

app.http('relayToDirectLine', {
    methods: ['GET'],
    authLevel: 'anonymous',
    handler: async (req, context) => {
        context.log('=== relayToDirectLine function started ===');
        context.log('Request method:', req.method);
        context.log('Request URL:', req.url);
        context.log('Request query:', req.query);
        
        // Log all headers
        context.log('All headers received:');
        for (const [key, value] of req.headers.entries()) {
            context.log(`  ${key}: ${value}`);
        }
        
        // Get the Direct Line secret from Authorization header
        const authHeader = req.headers.get('authorization');
        let dlSecret = null;
        
        if (authHeader && authHeader.startsWith('Bearer ')) {
            dlSecret = authHeader.substring(7); // Remove 'Bearer ' prefix
        }
        
        // Get other parameters from headers
        const conversationId = req.headers.get('conversationid');
        const watermark = req.headers.get('watermark');
        const waitTime = req.headers.get('waittime');

        context.log('Parsed values:');
        context.log(`  dlSecret (from Authorization): ${dlSecret ? '[REDACTED]' : 'undefined'}`);
        context.log(`  conversationId: ${conversationId}`);
        context.log(`  watermark: ${watermark}`);
        context.log(`  waitTime: ${waitTime}`);

        const defaultHeaders = {
            'Content-Type': 'application/json'
        };

        const errorResponse = (message) => {
            context.log('ERROR: Returning error response:', message);
            return {
                status: 400,
                headers: defaultHeaders,
                body: JSON.stringify({
                    error: {
                        code: 'BadArgument',
                        message
                    }
                })
            };
        };

        // Validate required parameters
        if (!dlSecret) {
            context.log('Validation failed: Authorization header with Bearer token is missing');
            return errorResponse('Authorization header with Bearer token is required');
        }
        if (!conversationId) {
            context.log('Validation failed: Conversation ID is missing');
            return errorResponse('Conversation ID is missing.');
        }
        if (!watermark) {
            context.log('Validation failed: Watermark is missing');
            return errorResponse('Watermark is missing.');
        }

        context.log('All validations passed');

        let waittime = 2000;
        if (waitTime) {
            waittime = parseInt(waitTime);
            context.log(`Wait time parsed: ${waittime}ms`);
        }

        context.log(`Waiting ${waittime}ms before calling Direct Line`);
        await new Promise((r) => setTimeout(r, waittime));
        context.log('Wait completed');

        const url = `https://directline.botframework.com/v3/directline/conversations/${conversationId}/activities?watermark=${watermark}`;
        const options = {
            url,
            headers: {
                Authorization: `Bearer ${dlSecret}`,
                'Content-Type': 'application/json'
            }
        };

        context.log('Prepared Direct Line request:');
        context.log(`  URL: ${url}`);
        context.log('  Headers: Authorization: Bearer [REDACTED], Content-Type: application/json');

        try {
            context.log('Sending request to Direct Line API...');
            const response = await request(options);
            context.log('Response received from Direct Line');
            context.log('Response type:', typeof response);
            context.log('Response length:', response ? (typeof response === 'string' ? response.length : JSON.stringify(response).length) : 0);
            
            // Log first 200 chars of response for debugging
            const responsePreview = typeof response === 'string' 
                ? response.substring(0, 200) 
                : JSON.stringify(response).substring(0, 200);
            context.log('Response preview:', responsePreview + '...');

            const successResponse = {
                status: 200,
                headers: defaultHeaders,
                body: typeof response === 'string' ? response : JSON.stringify(response)
            };
            
            context.log('=== Function completed successfully ===');
            return successResponse;
        } catch (err) {
            context.log('ERROR: Request to Direct Line failed');
            context.log('Error type:', err.name);
            context.log('Error message:', err.message);
            context.log('Error status code:', err.statusCode);
            context.log('Error stack:', err.stack);
            if (err.error) {
                context.log('Error details:', typeof err.error === 'string' ? err.error : JSON.stringify(err.error));
            }

            const errorReturn = {
                status: err.statusCode || 500,
                headers: defaultHeaders,
                body: JSON.stringify(typeof err.error === 'string' ? { error: err.error } : err.error || { error: 'Unknown error' })
            };
            
            context.log('=== Function completed with error ===');
            return errorReturn;
        }
    }
});