const notFoundMiddleware = (req, res) => {
    res.status(404).json({
        message: `Route ${req.method} ${req.originalUrl} not found`
    });
}

export default notFoundMiddleware;