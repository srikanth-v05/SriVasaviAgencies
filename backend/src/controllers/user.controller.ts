import { Request, Response } from "express";
import { UserService } from "../services/user.service";
import { ApiResponse } from "../utils/response";
import { serialize } from "../utils/serialize";

export class UserController {
  constructor(private userService: UserService) {}

  list = async (_req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.userService.list()));
  };

  get = async (req: Request, res: Response) => {
    return ApiResponse.success(res, serialize(await this.userService.getById(req.params.id)));
  };

  create = async (req: Request, res: Response) => {
    const user = await this.userService.create(req.body);
    return ApiResponse.created(res, serialize(user), "User created");
  };

  update = async (req: Request, res: Response) => {
    const user = await this.userService.update(req.params.id, req.body, req.user!.sub);
    return ApiResponse.success(res, serialize(user), "User updated");
  };

  resetPassword = async (req: Request, res: Response) => {
    await this.userService.resetPassword(req.params.id, req.body.newPassword);
    return ApiResponse.success(res, null, "Password reset. The user has been signed out everywhere.");
  };
}
