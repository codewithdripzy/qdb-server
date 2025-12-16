import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

/**
 * DB Manager Middleware
 * Serves the Admin UI and handles basic auth.
 */
export const dbManager = (req: http.IncomingMessage, res: http.ServerResponse): boolean => {
    // Check if request is for Admin UI
    if (!req.url?.startsWith('/admin')) {
        return false;
    }

    // Basic Auth Check (Placeholder - user should configure this)
    // For now, we allow access or check simple header
    // const authHeader = req.headers.authorization;

    // Serve Static Files
    // Mapping /admin to dist/ui
    // If /admin, serve index.html

    let filePath = './dist/ui' + req.url.replace('/admin', '');
    if (filePath === './dist/ui' || filePath === './dist/ui/') {
        filePath = './dist/ui/index.html';
    }

    const extname = path.extname(filePath);
    let contentType = 'text/html';
    switch (extname) {
        case '.js':
            contentType = 'text/javascript';
            break;
        case '.css':
            contentType = 'text/css';
            break;
        case '.json':
            contentType = 'application/json';
            break;
        case '.png':
            contentType = 'image/png';
            break;
        case '.jpg':
            contentType = 'image/jpg';
            break;
    }

    fs.readFile(filePath, (error, content) => {
        if (error) {
            if (error.code == 'ENOENT') {
                // Page not found
                res.writeHead(404);
                res.end('Page not found');
            } else {
                // Server error
                res.writeHead(500);
                res.end('Sorry, check with the site admin for error: ' + error.code + ' ..\n');
            }
        }
        else {
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content, 'utf-8');
        }
    });

    return true;
};
