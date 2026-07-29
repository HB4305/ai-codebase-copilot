import getHealthStatus from "../services/health.service.js";

const getHealth = (req, res) => {
    const health = getHealthStatus();
    res.json(health);
}

export default getHealth;