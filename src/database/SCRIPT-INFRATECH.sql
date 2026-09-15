CREATE DATABASE InfraTech;
USE InfraTech ;

-- -----------------------------------------------------
-- Table `InfraTech`.`endereco`
-- -----------------------------------------------------
CREATE TABLE endereco (
  id_endereco INT PRIMARY KEY AUTO_INCREMENT,
  cep CHAR(8) NOT NULL,
  logradouro VARCHAR(100) NOT NULL,
  bairro VARCHAR(100) NOT NULL,
  numero VARCHAR(20) NOT NULL,
  complemento VARCHAR(100),
  estado CHAR(2) NOT NULL,
  cidade VARCHAR(100) NOT NULL
);


-- -----------------------------------------------------
-- Table `InfraTech`.`empresa`
-- -----------------------------------------------------
CREATE TABLE empresa (
  idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
  razaoSocial VARCHAR(100) NOT NULL,
  nomeFantasia VARCHAR(100) NOT NULL,
  cnpj CHAR(14) NOT NULL,
  segmento_atuacao VARCHAR(80) NOT NULL,
  email VARCHAR(200) UNIQUE NOT NULL,
  telefone VARCHAR(20) NOT NULL,
  status_sistema TINYINT NOT NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  fk_endereco INT,
    FOREIGN KEY (fk_endereco) 
    REFERENCES endereco(id_endereco)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`funcionario`
-- -----------------------------------------------------
CREATE TABLE funcionario (
  idFuncionario INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  adm TINYINT DEFAULT 0,
  nome VARCHAR(45) NOT NULL,
  dataNascimento DATETIME NOT NULL,
  email VARCHAR(45) NOT NULL,
  senha VARCHAR(45) NOT NULL,
  cpf CHAR(11) NOT NULL,
  status_sistema TINYINT NOT NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT fk_funcionario_empresa
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa)
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor`
-- -----------------------------------------------------
CREATE TABLE servidor (
  idServidor INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  nome VARCHAR(45) NULL,
  status_sistema TINYINT NOT NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT cfkEmpresa 
  FOREIGN KEY (fkEmpresa) 
  REFERENCES empresa(idEmpresa)
  );




-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_funcionario`
-- -----------------------------------------------------
CREATE TABLE servidor_funcionario (
  fkFuncionario INT NOT NULL,
  fkServidor INT NOT NULL,
  PRIMARY KEY (fkFuncionario,fkServidor),
  CONSTRAINT fk_servidor_funcionario_funcionario1
    FOREIGN KEY (fkFuncionario)
    REFERENCES funcionario (idFuncionario),
  CONSTRAINT fk_servidor_funcionario_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES servidor (idServidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`convite`
-- -----------------------------------------------------
CREATE TABLE convite (
  idConvite INT PRIMARY KEY AUTO_INCREMENT NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  tipoAcesso VARCHAR(45) NOT NULL,
  quantidadeUso INT NOT NULL,
  quantidadeUsada INT NOT NULL DEFAULT 0,
  criado DATETIME DEFAULT NOW(),
  fkEmpresa INT NOT NULL,
  CONSTRAINT fk_convite_empresa
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa));


-- -----------------------------------------------------
-- Table `InfraTech`.`componente`
-- -----------------------------------------------------
CREATE TABLE componente (
  idComponente INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(45) NOT NULL
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_componente`
-- -----------------------------------------------------
CREATE TABLE servidor_componente (
  fkServidor INT NOT NULL,
  fkComponente INT NOT NULL,
  capacidade FLOAT NOT NULL,
  limiteAlerta FLOAT NOT NULL,
  PRIMARY KEY (fkServidor, fkComponente),
  CONSTRAINT fk_servidor_has_componente_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES servidor (idServidor),
  CONSTRAINT fk_servidor_has_componente_componente1
    FOREIGN KEY (fkComponente)
    REFERENCES componente (idComponente));


INSERT INTO empresa (nome, cnpj) VALUES
('InfraTech Games', '12345678000101'),
('GameCloud', '23456789000102'),
('TechPlay', '34567890000103');



INSERT INTO funcionario 
(fkEmpresa, tipoAcesso, nome, email, senha, cpf) VALUES
(1, 'Administrador', 'Maria Eduarda', 'maria@infratech.com', '123456', '12345678901'),
(1, 'Analista', 'Amanda Tavares', 'amanda@infratech.com', '123456', '23456789012'),
(2, 'Administrador', 'Arthur Martins', 'arthur@gamecloud.com', '123456', '34567890123'),
(2, 'Analista', 'Isaac Azevedo', 'isaac@gamecloud.com', '123456', '45678901234'),
(3, 'Administrador', 'Jefferson Lima', 'jefferson@techplay.com', '123456', '56789012345'),
(3, 'Analista', 'Guilherme Pastorello', 'guilherme@techplay.com', '123456', '67890123456');



INSERT INTO servidor (nome, fkEmpresa) VALUES
('Servidor Principal', 1),
('Servidor Backup', 1),
('Servidor Game 01', 2),
('Servidor Game 02', 3),
('Servidor Game 03', 3);


INSERT INTO servidor_has_funcionario 
(fkFuncionario, fkServidor) VALUES
(1, 1),
(2, 1),
(1, 2),
(3, 3),
(4, 3),
(5, 4),
(6, 5);

INSERT INTO convite 
(idConvite, codigo, tipoAcesso, quantidadeUso, fkEmpresa) VALUES
(1, 'INFRA-ADM-001', 'Administrador', 5, 1),
(2, 'INFRA-ANA-001', 'Analista', 10, 1),
(3, 'GAME-ADM-001', 'Administrador', 5, 2),
(4, 'GAME-ANA-001', 'Analista', 10, 2),
(5, 'TECH-ADM-001', 'Administrador', 5, 3);


INSERT INTO componente (nome) VALUES
('CPU'),
('RAM'),
('Disco'),
('Rede');


INSERT INTO servidor_has_componente 
(fkServidor, fkComponente, capacidade, limiteAlerta) VALUES
(1, 1, 100, 80),
(1, 2, 128, 80),
(1, 3, 2000, 90),
(1, 4, 1000, 80),

(2, 1, 100, 80),
(2, 2, 64, 80),
(2, 3, 4000, 90),
(2, 4, 1000, 80),

(3, 1, 100, 80),
(3, 2, 64, 80),
(3, 3, 2000, 90),
(3, 4, 1000, 80),

(4, 1, 100, 80),
(4, 2, 128, 80),
(4, 3, 4000, 90),
(4, 4, 1000, 80),

(5, 1, 100, 80),
(5, 2, 64, 80),
(5, 3, 2000, 90),
(5, 4, 1000, 80);

--------------------------------------------------------
---------- Mudanças feitas no Banco de Dados -----------
--------------------------------------------------------

-- Tabela endereço do servidor 
-- Campos da tabela endereço:
  -- sem nome
  -- add razaoSocial
  -- add nomeFantasia
  -- 