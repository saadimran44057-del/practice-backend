export const handleError = (res, error) => {
    if (error.name === 'SequelizeValidationError') {
      const messages = error.errors.map((e) => e.message);
      return res.status(400).json({ status: false, errors: messages });
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      const messages = error.errors.map((e) => e.message);
      return res.status(409).json({ status: false, errors: messages });
    }
    res.status(500).json({ status: false, message: error.message });
  };