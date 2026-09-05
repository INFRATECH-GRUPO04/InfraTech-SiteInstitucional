CREATE DATABASE InfraTech;
USE InfraTech ;

-- -----------------------------------------------------
-- Table `InfraTech`.`empresa`
-- -----------------------------------------------------
CREATE TABLE empresa (
  idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(45) NULL,
  cnpj CHAR(14) NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`funcionario`
-- -----------------------------------------------------
CREATE TABLE funcionario (
  idFuncionario INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  tipoAcesso VARCHAR(45) NULL,
  nome VARCHAR(45) NULL,
  email VARCHAR(45) NULL,
  senha VARCHAR(45) NULL,
  cpf CHAR(11) NULL,
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
  nome VARCHAR(45) NULL,
  localizacao VARCHAR(45) NULL,
  dtCadastro DATETIME DEFAULT CURRENT_TIMESTAMP
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`instancia`
-- -----------------------------------------------------
CREATE TABLE instancia (
  idInstancia INT PRIMARY KEY AUTO_INCREMENT NOT NULL,
  instanceUUID VARCHAR(45) NULL,
  dtCadastro DATETIME NULL,
  nome VARCHAR(45) NULL,
  fkServidor INT NOT NULL,
  CONSTRAINT fk_vm_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES servidor (idServidor));


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_funcionario`
-- -----------------------------------------------------
CREATE TABLE servidor_has_funcionario (
  fkFuncionario INT NOT NULL,
  fkServidor INT NOT NULL,
  PRIMARY KEY (fkFuncionario,fkServidor),
  CONSTRAINT fk_servidor_has_funcionario_funcionario1
    FOREIGN KEY (fkFuncionario)
    REFERENCES funcionario (idFuncionario),
  CONSTRAINT fk_servidor_has_funcionario_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES servidor (idServidor)
);


-- -----------------------------------------------------
-- Table `InfraTech`.`convite`
-- -----------------------------------------------------
CREATE TABLE convite (
  idConvite INT PRIMARY KEY NOT NULL,
  codigo VARCHAR(100) NOT NULL,
  tipoAcesso VARCHAR(45) NULL,
  quantidadeUso INT NULL,
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
  nome VARCHAR(45) NULL
  );


-- -----------------------------------------------------
-- Table `InfraTech`.`instancia_has_componente`
-- -----------------------------------------------------
CREATE TABLE instancia_has_componente (
  fkInstancia INT NOT NULL,
  fkComponente INT NOT NULL,
  capacidade FLOAT NULL,
  limiteAlerta FLOAT NULL,
  PRIMARY KEY (fkInstancia, fkComponente),
  CONSTRAINT fk_vm_has_componente_vm1
    FOREIGN KEY (fkInstancia)
    REFERENCES instancia (idInstancia),
  CONSTRAINT fk_vm_has_componente_componente1
    FOREIGN KEY (fkComponente)
    REFERENCES componente (idComponente));


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_componente`
-- -----------------------------------------------------
CREATE TABLE servidor_has_componente (
  fkServidor INT NOT NULL,
  fkComponente INT NOT NULL,
  capacidade FLOAT NULL,
  limiteAlerta FLOAT NULL,
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



INSERT INTO servidor (nome, localizacao) VALUES
('Servidor Principal', 'São Paulo'),
('Servidor Backup', 'Rio de Janeiro'),
('Servidor Game 01', 'São Paulo'),
('Servidor Game 02', 'Curitiba'),
('Servidor Game 03', 'Belo Horizonte');



INSERT INTO instancia 
(instanceUUID, dtCadastro, nome, fkServidor) VALUES
('550e8400-e29b-41d4-a716-446655440000', NOW(), 'Instancia Fortnite', 1),
('550e8400-e29b-41d4-a716-446655440001', NOW(), 'Instancia Roblox', 1),
('550e8400-e29b-41d4-a716-446655440002', NOW(), 'Instancia Genshin', 2),
('550e8400-e29b-41d4-a716-446655440003', NOW(), 'Instancia League of Legends', 3),
('550e8400-e29b-41d4-a716-446655440004', NOW(), 'Instancia Minecraft', 4);


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



INSERT INTO instancia_has_componente 
(fkInstancia, fkComponente, capacidade, limiteAlerta) VALUES
(1, 1, 100, 80),
(1, 2, 32, 80),
(1, 3, 500, 90),
(1, 4, 1000, 80),

(2, 1, 100, 80),
(2, 2, 16, 80),
(2, 3, 500, 90),
(2, 4, 1000, 80),

(3, 1, 100, 80),
(3, 2, 32, 80),
(3, 3, 1000, 90),
(3, 4, 1000, 80),

(4, 1, 100, 80),
(4, 2, 16, 80),
(4, 3, 500, 90),
(4, 4, 1000, 80),

(5, 1, 100, 80),
(5, 2, 32, 80),
(5, 3, 1000, 90),
(5, 4, 1000, 80);


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