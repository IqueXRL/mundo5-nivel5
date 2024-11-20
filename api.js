const express = require('express');
const db = require('./db');
const jwt = require('jsonwebtoken');
const bodyParser = require('body-parser');

const app = express();

// Configurando o middleware para analisar o corpo das requisições como JSON
app.use(bodyParser.json());

const port = process.env.PORT || 3000;

// Chave usada para geração e validação dos tokens JWT
const secretKey = 'P@%+~~=0[2YW59l@M+5ctb-;|Y4{z;1om1CuyN#n0t)pm0/yEC0"dn`wvg92D7A';

app.listen(port, () => {
  console.log(`Servidor ativo na porta ${port}`);
});

// Middleware para verificar se o token JWT é válido
function verifyToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ message: 'Token não fornecido' });

  jwt.verify(token, secretKey, (err, user) => {
    if (err) return res.status(403).json({ message: 'Token inválido' });
    req.user = user;
    next();
  });
}

// Middleware para validar se o usuário possui perfil de administrador
function checkAdminPrivileges(req, res, next) {
  getUserRole(req.user.usuario_id).then(role => {
    if (role !== 'admin') {
      return res.status(403).json({ message: 'Acesso negado: apenas para administradores' });
    }
    next();
  }).catch(err => {
    res.status(500).json({ message: 'Erro interno do servidor' });
  });
}

// Rota para autenticação do usuário e geração de token
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;

  authenticateUser({ username, password }).then(user => {
    if (user) {
      // Gera o token de autenticação com duração de 1 hora
      const token = jwt.sign({ usuario_id: user.id }, secretKey, { expiresIn: '1h' });
      res.json({ sessionid: token });
    } else {
      res.status(401).json({ message: 'Credenciais inválidas' });
    }
  }).catch(err => {
    res.status(500).json({ message: 'Erro interno do servidor' });
  });
});

// Rota para recuperar informações do usuário autenticado
app.get('/api/me', verifyToken, (req, res) => {
  fetchUserById(req.user.usuario_id).then(user => {
    res.status(200).json({ data: user });
  }).catch(err => {
    res.status(500).json({ message: 'Erro interno do servidor' });
  });
});

// Rota para listar todos os usuários, acessível apenas para administradores
app.get('/api/users', verifyToken, checkAdminPrivileges, (req, res) => {
  fetchAllUsers().then(users => {
    res.status(200).json({ data: users });
  }).catch(err => {
    res.status(500).json({ message: 'Erro interno do servidor' });
  });
});

// Rota para buscar contratos filtrados por empresa e data
app.get('/api/contracts/:empresa/:inicio', verifyToken, checkAdminPrivileges, async (req, res) => {
  const { empresa, inicio } = req.params;

  try {
    const contracts = await fetchContracts(empresa, inicio);
    if (contracts.length > 0) {
      res.status(200).json({ data: contracts });
    } else {
      res.status(404).json({ message: 'Dados não encontrados' });
    }
  } catch (error) {
    res.status(500).json({ message: 'Erro interno do servidor' });
  }
});

// Executa uma consulta SQL que retorna um único registro
function runQuery(query, params = []) {
  return new Promise((resolve, reject) => {
    db.get(query, params, (err, result) => {
      if (err) {
        reject(err);
      } else {
        resolve(result);
      }
    });
  });
}


// Executa uma consulta SQL que retorna múltiplos registros
function runQueryAll(query, params = []) {
  return new Promise((resolve, reject) => {
    db.all(query, params, (err, results) => {
      if (err) {
        reject(err);
      } else {
        resolve(results);
      }
    });
  });
}



// Busca informações de um usuário pelo ID
function fetchUserById(userId) {
  return runQuery('SELECT id, username, email, perfil FROM users WHERE id = ?', [userId]);
}

// Retorna todos os usuários cadastrados
function fetchAllUsers() {
  return runQueryAll('SELECT * FROM users');
}

// Autentica o usuário com base nas credenciais fornecidas
function authenticateUser({ username, password }) {
  return runQuery('SELECT * FROM users WHERE username = ? AND password = ?', [username, password]);
}


// Obtém o papel do usuário (perfil) pelo ID
function getUserRole(userId) {
  return runQuery('SELECT perfil FROM users WHERE id = ?', [userId]).then(row => row.perfil);
}



// Recupera os contratos filtrados por empresa e data de início
function fetchContracts(empresa, inicio) {
  return runQueryAll('SELECT * FROM contracts WHERE empresa = ? AND data_inicio = ?', [empresa, inicio]);
}
