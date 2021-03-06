import picgo from 'picgo'
import fs from 'fs'
import path from 'path'
import probe from 'probe-image-size'
import { MigrateResult } from './interface'
import { ImgInfo } from 'picgo/dist/utils/interfaces'

class Migrater {
  ctx: picgo
  guiApi: any
  urlList: any
  urlArray: any[]
  baseDir: string
  constructor (ctx: picgo, filePath: string) {
    this.ctx = ctx
    this.baseDir = path.dirname(filePath)
  }

  init (urlList: any) {
    this.urlList = urlList
    this.urlArray = Object.keys(urlList)
  }

  async migrate (): Promise<MigrateResult> {
    let input = []
    this.ctx.setConfig({
      'picBed.transformer': 'base64'
    })
    this.ctx.output = [] // a bug before picgo v1.2.2
    for (let i in this.urlArray) {
      try {
        let uploadData: ImgInfo | Boolean
        let picPath = this.getLocalPath(this.urlArray[i])
        if (!picPath) {
          uploadData = await this.handlePicFromURL(this.urlArray[i])
        } else {
          uploadData = await this.handlePicFromLocal(picPath, this.urlArray[i])
        }
        if (uploadData) {
          input.push(uploadData)
        }
      } catch (e) {
        console.log(e)
      }
    }
    if (input.length > 0) { // ensure there are available pics
      await this.ctx.upload(input)
      for (let item of this.ctx.output) {
        if (this.urlList[item.origin]) {
          if (item.imgUrl) {
            this.urlList[item.origin] = item.imgUrl
          }
        }
      }
    }
    let result = {
      urlList: Object.assign({}, this.urlList),
      result: {
        success: this.calcSuccessLength(),
        total: this.urlArray.length
      }
    }
    return result
  }

  getLocalPath (imgPath: string) {
    if (!path.isAbsolute(imgPath)) {
      imgPath = path.join(this.baseDir, imgPath)
    }
    if (fs.existsSync(imgPath)) {
      return imgPath
    } else {
      return false
    }
  }

  getPicFromURL (url) {
    return this.ctx.Request.request({
      url,
      encoding: null
    })
  }

  async handlePicFromLocal (picPath: string, origin: string) {
    if (fs.existsSync(picPath)) {
      let fileName = path.basename(picPath)
      let buffer = fs.readFileSync(picPath)
      let imgSize = probe.sync(buffer)
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname: path.extname(picPath),
        origin
      }
    } else {
      return false
    }
  }

  async handlePicFromURL (url: string) {
    try {
      let buffer = await this.getPicFromURL(url)
      let fileName = path.basename(url)
      let imgSize = probe.sync(buffer)
      return {
        buffer,
        fileName,
        width: imgSize.width,
        height: imgSize.height,
        extname: `.${imgSize.type}`,
        origin: url
      }
    } catch (e) {
      return false
    }
  }

  calcSuccessLength () {
    let count = 0
    for (let i in this.urlList) {
      if (this.urlList[i] !== i) {
        count += 1
      }
    }
    return count
  }
}

export default Migrater
