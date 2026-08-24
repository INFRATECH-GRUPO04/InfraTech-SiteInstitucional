-- -----------------------------------------------------
-- Schema InfraTech
-- -----------------------------------------------------
CREATE DATABASE InfraTech;
USE InfraTech;

-- -----------------------------------------------------
-- Table `InfraTech`.`empresa`
-- -----------------------------------------------------
CREATE TABLE empresa (
  idEmpresa INT PRIMARY KEY AUTO_INCREMENT,
  nome VARCHAR(45)NOT NULL,
  cnpj CHAR(13)NOT NULL,
  dtCadastro DATETIME NOT NULL
  );

show tables;

-- -----------------------------------------------------
-- Table `InfraTech`.`funcionario`
-- -----------------------------------------------------
CREATE TABLE funcionario (
  idFuncionario INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  tipoAcesso VARCHAR(45) NOT NULL,
  email VARCHAR(60) NOT NULL,
  senhaHash VARCHAR(45) NOT NULL,
  nome VARCHAR(60) NOT NULL,
  dtCadastro DATETIME NOT NULL,
  CONSTRAINT fk_funcionario_empresa
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa));


-- -----------------------------------------------------
-- Table `InfraTech`.`vm`
-- -----------------------------------------------------
CREATE TABLE vm (
  idVm INT PRIMARY KEY AUTO_INCREMENT,
  fkEmpresa INT NOT NULL,
  instanceUUID VARCHAR(45) NULL,
  dtCadastro DATETIME NULL,
  nome VARCHAR(45) NULL,
  CONSTRAINT fk_servidor_empresa1
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa));


-- -----------------------------------------------------
-- Table `InfraTech`.`servidor_has_funcionario`
-- -----------------------------------------------------
CREATE TABLE servidor_has_funcionario(
  fkServidor INT NOT NULL,
  fkFuncionario INT NOT NULL,
  PRIMARY KEY (fkServidor, fkFuncionario),
  CONSTRAINT fk_servidor_has_funcionario_servidor1
    FOREIGN KEY (fkServidor)
    REFERENCES vm (idVm),
  CONSTRAINT fk_servidor_has_funcionario_funcionario1
    FOREIGN KEY (fkFuncionario)
    REFERENCES funcionario (idFuncionario));


-- -----------------------------------------------------
-- Table `InfraTech`.`convite`
-- -----------------------------------------------------
CREATE TABLE convite (
  idConvite INT PRIMARY KEY AUTO_INCREMENT,
  codigo VARCHAR(100) NOT NULL,
  tipoAcesso VARCHAR(45) NULL,
  usado TINYINT NULL,
  criado DATETIME NULL,
  fkEmpresa INT NOT NULL,
  CONSTRAINT fk_convite_empresa1
    FOREIGN KEY (fkEmpresa)
    REFERENCES empresa (idEmpresa));


-- -----------------------------------------------------
-- Table `InfraTech`.`ram`
-- -----------------------------------------------------
CREATE TABLE ram (
  idRam INT PRIMARY KEY AUTO_INCREMENT,
  capacidade FLOAT NULL,
  limiteAlerta FLOAT NULL,
  fkVm INT NOT NULL,
  CONSTRAINT fk_ram_vm1
    FOREIGN KEY (fkVm)
    REFERENCES vm (idVm));


-- -----------------------------------------------------
-- Table `InfraTech`.`cpu`
-- -----------------------------------------------------
CREATE TABLE cpu (
  idCpu INT PRIMARY KEY AUTO_INCREMENT,
  capacidade FLOAT NULL,
  limiteAlerta FLOAT NULL,
  fkVm INT NOT NULL,
  CONSTRAINT fk_Cpu_vm1
    FOREIGN KEY (fkVm)
    REFERENCES vm (idVm));


-- -----------------------------------------------------
-- Table `InfraTech`.`disco`
-- -----------------------------------------------------
CREATE TABLE disco (
  idDisco INT PRIMARY KEY AUTO_INCREMENT,
  capacidade FLOAT NULL,
  limiteAlerta FLOAT NULL,
  fkVm INT NOT NULL,
  CONSTRAINT fk_Disco_vm1
    FOREIGN KEY (fkVm)
    REFERENCES vm (idVm));
