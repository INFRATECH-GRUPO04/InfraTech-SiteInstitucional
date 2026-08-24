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
  email VARCHAR(45) NULL,
  senha VARCHAR(45) NULL,
  nome VARCHAR(45) NULL,
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
  usado TINYINT NULL,
  criado DATETIME NULL,
  fkEmpresa INT NOT NULL,
  CONSTRAINT fk_convite_empresa1
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