var http = require('http')
var fs = require('fs')
var url = require('url')
var port = process.argv[2]

if (!port) {
  console.log('请指定端口号。\n例如：node server.js 8080')
  process.exit(1)
}

// 创建sessions
let sessions = {}

var server = http.createServer(function (request, response) {
  var parsedUrl = url.parse(request.url, true)
  var pathWithQuery = request.url
  var queryString = ''
  if (pathWithQuery.indexOf('?') >= 0) {
    queryString = pathWithQuery.substring(pathWithQuery.indexOf('?'))
  }
  var path = parsedUrl.pathname
  var query = parsedUrl.query
  var method = request.method

  /******** 路由代码开始 ********/

  console.log('含查询字符串的路径\n' + pathWithQuery)

  if (path === '/' || path === '/index.html') {
    let string = fs.readFileSync('./index.html', 'utf8')
    let cookies = ''
    if (request.headers.cookie) {
      // 分割cookie
      cookies = request.headers.cookie.split('; ') // ['email=1@', 'a=1', 'b=2']
    }
    let hash = {}
    for (let i = 0; i < cookies.length; i++) {
      let parts = cookies[i].split('=')
      let key = parts[0]
      let value = parts[1]
      hash[key] = value
    }
    // 校验cookie与数据库的email
    // 拿到session
    let mySession = sessions[hash.sessionId]
    // 拿到email
    let email
    if (mySession) {
      email = mySession.sign_in_email
    }
    let users = fs.readFileSync('./db/users', 'utf8')
    users = JSON.parse(users)
    let foundUser
    for (let i = 0; i < users.length; i++) {
      if (users[i].email === email) {
        foundUser = users[i]
        break
      }
    }
    // 替换index页面的字符串
    if (foundUser) {
      string = string.replace('__password__', foundUser.password)
    } else {
      string = string.replace('__password__', '不知道')
    }
    // 响应新的index字符串
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_up' && method === 'GET') {
    // 12.请求 注册页面
    var string = fs.readFileSync('./sign_up.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_up' && method === 'POST') {
    // 13.请求 注册表单提交
    readRequestBody(request).then((requestBody) => {
      // 解码
      let decodedRequestBody = decodeURIComponent(requestBody)
      // 分割成字符串数组['email=123@qq.com','password=456','password_confirmation=456']
      let arrayOfStrings = decodedRequestBody.split('&')
      // 进一步分割并放入一个hash里
      let hash = {}
      arrayOfStrings.forEach((xxx) => {
        let parts = xxx.split('=')
        let key = parts[0]
        let value = parts[1]
        hash[key] = value
      })
      // 把hash分开赋值给几个变量
      let {
        email,
        password,
        password_confirmation
      } = hash;
      // 校验 email 有没有 @
      if (email.indexOf('@') === -1) {
        response.statusCode = 400
        response.setHeader('Content-Type', 'application/json;charset=utf-8')
        response.write(`{
        "errors":{
          "email":"invalid"
        }
      }`)
      } else if (password !== password_confirmation) {
        // 校验密码一致性
        response.statusCode = 400
        response.write('password not match')
      } else {
        // 读取数据库
        var users = fs.readFileSync('./db/users', 'utf-8')
        // 尝试解析users为JSON，如果不符合语法，就清空数组
        try {
          users = JSON.parse(users)
        } catch (exception) {
          users = []
        }
        // 检查email是否已经存在
        let inUse = false
        for (let i = 0; i < users.length; i++) {
          let user = users[i]
          if (user.email === email) {
            inUse = true
            break
          }
        }
        // email存在就返回400和错误
        if (inUse) {
          response.statusCode = 400
          response.write('email in use')
        } else {
          users.push({
            email: email,
            password: password
          })
          var usersString = JSON.stringify(users)
          fs.writeFileSync('./db/users', usersString)
          response.statusCode = 200
        }
      }
      response.end()
    })
  } else if (path === '/sign_in' && method === 'GET') {
    // 14.请求 登陆页面
    var string = fs.readFileSync('./sign_in.html', 'utf8')
    response.statusCode = 200
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write(string)
    response.end()
  } else if (path === '/sign_in' && method === 'POST') {
    // 15.请求 登陆表单提交
    readRequestBody(request).then((requestBody) => {
      // 解码
      let decodedRequestBody = decodeURIComponent(requestBody)
      // 分割成字符串数组['email=123@qq.com','password=456']
      let arrayOfStrings = decodedRequestBody.split('&')
      // 进一步分割并放入一个hash里
      let hash = {}
      arrayOfStrings.forEach((xxx) => {
        let parts = xxx.split('=')
        let key = parts[0]
        let value = parts[1]
        hash[key] = value
      })
      // 把hash分开赋值给几个变量
      let {
        email,
        password,
      } = hash;
      // 读取数据库
      var users = fs.readFileSync('./db/users', 'utf-8')
      // 尝试解析users为JSON，如果不符合语法，就清空数组
      try {
        users = JSON.parse(users)
      } catch (exception) {
        users = []
      }
      // 和数据库对比密码
      let found
      for (let i = 0; i < users.length; i++) {
        if (users[i].email === email && users[i].password === password) {
          found = true
          break
        }
      }
      // 账户密码一致就登陆，否则401
      if (found) {
        // 通过cookie发送sessionId给前端
        let sessionId = Math.random() * 100000
        sessions[sessionId] = {
          sign_in_email: email
        }
        response.setHeader('Set-Cookie', `sessionId=${sessionId}`)
        response.statusCode = 200
      } else {
        response.statusCode = 401
      }
      response.end()
    })
  } else {
    // 0.请求失败。返回404.
    response.statusCode = 404
    response.setHeader('Content-Type', 'text/html;charset=utf-8')
    response.write('请求失败')
    response.end()
  }

  /******** 路由代码结束 ********/
})

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let requestBody = []
    request.on('data', (chunk) => {
      requestBody.push(chunk)
    }).on('end', () => {
      requestBody = Buffer.concat(requestBody).toString()
      resolve(requestBody)
    })
  })
}

server.listen(port)
console.log('监听 ' + port + ' 成功\n请用浏览器打开 http://localhost:' + port)