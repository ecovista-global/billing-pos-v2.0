function enforceStoreContext(req, res, next) {
  req.storeContext = {
    store_id: null,
    isAllStores: false
  };

  if (req.user.role === 'admin') {
    if (req.query.store_id && !isNaN(parseInt(req.query.store_id))) {
      req.storeContext.store_id = parseInt(req.query.store_id);
    } else {
      req.storeContext.isAllStores = true;
    }
  } else {
    req.storeContext.store_id = req.user.assigned_store_id;
    if (!req.storeContext.store_id) {
      return res.status(403).json({ 
        success: false, 
        message: 'Employee account has no assigned store. Contact administrator.' 
      });
    }
  }
  next();
}

module.exports = { enforceStoreContext };
