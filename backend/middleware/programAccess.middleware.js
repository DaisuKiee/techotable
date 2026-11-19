/**
 * Program Access Control Middleware
 * 
 * Ensures that program managers can only access data from their assigned program.
 * Admins have unrestricted access to all programs.
 * 
 * Usage:
 *   router.use(checkProgramAccess('Schedule'));
 */

const mongoose = require('mongoose');

const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * The id of the single resource a request is about, or null.
 *
 * This middleware is mounted with `router.use(...)`, and Express does not
 * populate `req.params` for a `use` handler - route parameters only exist
 * inside the handler whose path declared them. So `req.params.id` was always
 * undefined here, and every by-id branch below (read one, update, delete) was
 * unreachable: a program manager could read, edit and delete another
 * program's classes, and because an accepted update also auto-stamps
 * `req.body.program` with the caller's own program, editing one silently
 * moved it into their program.
 *
 * The id is taken from the path instead, and only when the segment actually
 * looks like one - so `/ortools-status`, `/check-conflicts`, `/publish` and
 * `/program/:program/:yearLevel` are left alone.
 */
const resourceIdOf = (req) => {
  if (req.params && req.params.id) return req.params.id;
  const first = String(req.path || '').split('/').filter(Boolean)[0];
  return OBJECT_ID.test(first || '') ? first : null;
};

/**
 * Check if user has access to program-specific resources
 * 
 * @param {String} resourceModel - Name of the mongoose model (e.g., 'Schedule', 'Subject', 'Student')
 * @returns {Function} Express middleware function
 */
const checkProgramAccess = (resourceModel) => {
  return async (req, res, next) => {
    try {
      const user = req.user;

      // Admin has access to everything
      if (user.role === 'admin') {
        return next();
      }

      // Scheduling officers (legacy) maintain full access during transition
      if (user.role === 'scheduling_officer') {
        return next();
      }

      // Program manager - enforce program restrictions
      if (user.role === 'program_manager') {
        // Validate that user has a program assigned
        if (!user.program) {
          return res.status(403).json({
            error: 'Access denied',
            message: 'Program managers must have an assigned program'
          });
        }

        const resourceId = resourceIdOf(req);

        // For GET requests - add program filter to query
        if (req.method === 'GET') {
          // If fetching a specific resource by ID
          if (resourceId) {
            const Model = mongoose.model(resourceModel);
            const resource = await Model.findById(resourceId);

            if (!resource) {
              return res.status(404).json({ 
                error: 'Resource not found' 
              });
            }

            // Check if resource has a program field and if it matches
            if (resource.program && resource.program !== user.program) {
              return res.status(403).json({
                error: 'Access denied',
                message: `You can only access ${user.program} resources`,
                resource: {
                  type: resourceModel,
                  program: resource.program
                },
                userProgram: user.program
              });
            }
          } else {
            // For list queries, inject program filter
            req.query.program = user.program;
          }
        }

        // For POST/PUT/PATCH - validate and enforce program
        if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
          // If program is specified in body and doesn't match, deny
          if (req.body.program && req.body.program !== user.program) {
            return res.status(403).json({
              error: 'Access denied',
              message: `You can only create/modify ${user.program} resources`,
              attempted: req.body.program,
              allowed: user.program
            });
          }

          // For UPDATE operations, verify existing resource
          if (resourceId && ['PUT', 'PATCH'].includes(req.method)) {
            const Model = mongoose.model(resourceModel);
            const resource = await Model.findById(resourceId);

            if (!resource) {
              return res.status(404).json({ 
                error: 'Resource not found' 
              });
            }

            if (resource.program && resource.program !== user.program) {
              return res.status(403).json({
                error: 'Access denied',
                message: `You can only modify ${user.program} resources`,
                resource: {
                  type: resourceModel,
                  program: resource.program
                },
                userProgram: user.program
              });
            }
          }

          // Auto-set program for create/update
          req.body.program = user.program;
        }

        // For DELETE - verify resource belongs to user's program
        if (req.method === 'DELETE' && resourceId) {
          const Model = mongoose.model(resourceModel);
          const resource = await Model.findById(resourceId);

          if (!resource) {
            return res.status(404).json({ 
              error: 'Resource not found' 
            });
          }

          if (resource.program && resource.program !== user.program) {
            return res.status(403).json({
              error: 'Access denied',
              message: `You can only delete ${user.program} resources`,
              resource: {
                type: resourceModel,
                program: resource.program
              },
              userProgram: user.program
            });
          }
        }
      }

      // Faculty and students have their own access patterns (handled in controllers)
      next();
    } catch (error) {
      console.error('Program access middleware error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Error checking program access'
      });
    }
  };
};

/**
 * Middleware specifically for faculty access
 * Faculty can view resources across programs if they teach them
 */
const checkFacultyAccess = async (req, res, next) => {
  try {
    const user = req.user;

    // Admin has full access
    if (user.role === 'admin') {
      return next();
    }

    // Faculty can only access their own schedules
    if (user.role === 'faculty') {
      if (req.method === 'GET') {
        // Add faculty filter for schedule queries
        if (user.facultyProfile) {
          req.query.faculty = user.facultyProfile;
        }
      } else {
        // Faculty cannot create/edit/delete schedules
        return res.status(403).json({
          error: 'Access denied',
          message: 'Faculty members cannot modify schedules'
        });
      }
    }

    next();
  } catch (error) {
    console.error('Faculty access middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking faculty access'
    });
  }
};

/**
 * Middleware for student access
 * Students can only view their enrolled classes
 */
const checkStudentAccess = async (req, res, next) => {
  try {
    const user = req.user;

    // Admin has full access
    if (user.role === 'admin') {
      return next();
    }

    // Students have read-only access to their data
    if (user.role === 'student') {
      if (req.method !== 'GET') {
        return res.status(403).json({
          error: 'Access denied',
          message: 'Students have read-only access'
        });
      }
      // Student-specific filtering is handled in controllers
    }

    next();
  } catch (error) {
    console.error('Student access middleware error:', error);
    return res.status(500).json({
      error: 'Internal server error',
      message: 'Error checking student access'
    });
  }
};

module.exports = {
  checkProgramAccess,
  checkFacultyAccess,
  checkStudentAccess
};
