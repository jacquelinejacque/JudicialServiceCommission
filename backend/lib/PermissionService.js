class PermissionService {
  static hasPermission(authUser, permission) {
    return Array.isArray(authUser?.permissions) &&
      authUser.permissions.includes(permission);
  }

  static hasAnyPermission(authUser, permissions = []) {
    return Array.isArray(authUser?.permissions) &&
      permissions.some((permission) => authUser.permissions.includes(permission));
  }

  static authorize(authUser, permission) {
    if (!authUser || !authUser.userID) {
      return {
        allowed: false,
        status: 401,
        message: "Unauthorized"
      };
    }

    if (!this.hasPermission(authUser, permission)) {
      return {
        allowed: false,
        status: 403,
        message: "Access denied"
      };
    }

    return {
      allowed: true
    };
  }
}

export default PermissionService;