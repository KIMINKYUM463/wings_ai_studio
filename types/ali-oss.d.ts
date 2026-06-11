declare module "ali-oss" {
  interface PutObjectResult {
    res: { status: number; statusCode?: number }
  }

  interface OSSOptions {
    region: string
    accessKeyId: string
    accessKeySecret: string
    stsToken?: string
    bucket: string
    endpoint?: string
  }

  export default class OSS {
    constructor(options: OSSOptions)
    put(name: string, file: string): Promise<PutObjectResult>
  }
}
