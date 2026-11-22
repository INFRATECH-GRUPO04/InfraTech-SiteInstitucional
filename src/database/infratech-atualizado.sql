-- =====================================================
-- CRIACAO E SELECAO DO BANCO DE DADOS
-- =====================================================
CREATE DATABASE infratech;
USE infratech;

-- =====================================================
-- TABELA: endereco
-- FINALIDADE: Armazena os enderecos das empresas.
-- =====================================================
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

-- =====================================================
-- TABELA: empresa
-- FINALIDADE: Armazena os dados cadastrais das empresas.
-- RELACIONAMENTO: fk_endereco referencia a tabela endereco.
-- =====================================================

CREATE TABLE empresa (
    id_empresa INT PRIMARY KEY AUTO_INCREMENT,
    razao_social VARCHAR(100) NOT NULL,
    nome_fantasia VARCHAR(100) NOT NULL,
    cnpj CHAR(14) NOT NULL,
    segmento_atuacao VARCHAR(80) NOT NULL,
    email VARCHAR(200) UNIQUE NOT NULL,
    telefone VARCHAR(20) NOT NULL,
    status_sistema TINYINT NOT NULL,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fk_endereco INT,

    FOREIGN KEY (fk_endereco)
        REFERENCES endereco(id_endereco)
);


-- =====================================================
-- TABELA: funcionario
-- FINALIDADE: Armazena os funcionarios e seus dados
-- de acesso ao sistema.
-- RELACIONAMENTO: Cada funcionario pertence a uma empresa.
-- =====================================================
CREATE TABLE funcionario (
    id_funcionario INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    tipo_acesso ENUM('INFRATECH', 'GESTOR', 'ANALISTA_DADOS', 'ANALISTA_NOC', 'ADMIN', 'FUNCIONARIO','ENGENHEIRO_QA')
        NOT NULL DEFAULT 'FUNCIONARIO',
    nome VARCHAR(45) NULL,
    dt_nascimento DATETIME NULL,
    email VARCHAR(45) NOT NULL,
    senha VARCHAR(45) NOT NULL,
    cpf CHAR(11) NULL,
    status_sistema TINYINT NOT NULL DEFAULT 1,
    pode_editar_alertas TINYINT(1) NOT NULL DEFAULT 0, -- confirmar
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_funcionario_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);

-- =====================================================
-- TABELA: servidor
-- FINALIDADE: Registra os servidores monitorados.
-- RELACIONAMENTO: Cada servidor pertence a uma empresa.
-- =====================================================
CREATE TABLE servidor (
    id_servidor INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    nome VARCHAR(45) NULL,
    localizacao VARCHAR(45) NULL,
    status_sistema TINYINT NOT NULL DEFAULT 1,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    -- VERIFICAÇÕES PARA O SCRIPT DE CAPTURA:
    chave_hash CHAR(64) NULL UNIQUE,
    dt_ultimo_envio DATETIME NULL,
    servidor_teste TINYINT NOT NULL DEFAULT 0,
    custo_mensal DECIMAL(10,2) NOT NULL DEFAULT 0,

    CONSTRAINT cfk_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);

-- =====================================================
-- TABELA: servidor_funcionario
-- FINALIDADE: Relaciona funcionarios aos servidores
-- aos quais possuem acesso.
-- RELACIONAMENTO: Muitos-para-muitos entre funcionario
-- e servidor.
-- CHAVE PRIMARIA: Composta pelas duas chaves estrangeiras.
-- =====================================================
CREATE TABLE servidor_funcionario (
    fk_funcionario INT NOT NULL,
    fk_servidor INT NOT NULL,

    PRIMARY KEY (fk_funcionario, fk_servidor),

    CONSTRAINT fk_servidor_funcionario_funcionario1
        FOREIGN KEY (fk_funcionario)
        REFERENCES funcionario(id_funcionario),

    CONSTRAINT fk_servidor_funcionario_servidor1
        FOREIGN KEY (fk_servidor)
        REFERENCES servidor(id_servidor)
);

-- =====================================================
-- TABELA: convite
-- FINALIDADE: Armazena codigos de convite utilizados
-- para permitir o cadastro de usuarios.
-- RELACIONAMENTO: Cada convite pertence a uma empresa.
-- =====================================================
CREATE TABLE convite (
    id_convite INT PRIMARY KEY AUTO_INCREMENT,
    codigo VARCHAR(100) NOT NULL,
    tipo_acesso VARCHAR(20) NOT NULL DEFAULT 'FUNCIONARIO',
    quantidade_uso INT NOT NULL,
    quantidade_usada INT NOT NULL DEFAULT 0,
    dt_criacao DATETIME DEFAULT NOW(),
    fk_empresa INT NOT NULL,

    CONSTRAINT fk_convite_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);

-- =====================================================
-- TABELA: componente
-- FINALIDADE: Registra os componentes de hardware
-- dos servidores, como CPU, RAM, disco e rede.
-- RELACIONAMENTO: Cada componente pertence a um servidor.
-- =====================================================
CREATE TABLE componente (
    id_componente INT PRIMARY KEY AUTO_INCREMENT,
    tipo VARCHAR(45) NOT NULL,
    capacidade_total DECIMAL(14,2),
    unidade_capacidade VARCHAR(45),
    status_monitoramento TINYINT NOT NULL DEFAULT 1,
    dt_cadastro DATETIME DEFAULT CURRENT_TIMESTAMP,
    fk_servidor INT NOT NULL,

    FOREIGN KEY (fk_servidor)
        REFERENCES servidor(id_servidor)
);

-- =====================================================
-- TABELA: metrica
-- FINALIDADE: Define quais metricas serao monitoradas
-- em cada componente e seus limites de alerta.
-- OBSERVACAO: Armazena a configuracao da metrica,
-- nao o historico dos valores coletados.
-- RELACIONAMENTO: Cada metrica pertence a um componente.
-- =====================================================
CREATE TABLE metrica (
    id_metrica INT PRIMARY KEY AUTO_INCREMENT,
    fk_componente INT NOT NULL,
    nome VARCHAR(60) NOT NULL,
    unidade VARCHAR(20) NOT NULL,
    limite_atencao DECIMAL(14,2),
    limite_critico DECIMAL(14,2),
    status_monitoramento TINYINT NOT NULL DEFAULT 1,

    FOREIGN KEY (fk_componente)
        REFERENCES componente(id_componente)
);

-- =====================================================
-- TABELA: limite_alerta_global
-- FINALIDADE: Guarda os limites padrao de alerta de cada empresa.
-- RELACIONAMENTO: Cada registro pertence a uma empresa.
-- =====================================================

CREATE TABLE IF NOT EXISTS limite_alerta_global (
    id_limite_global INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    tipo ENUM('cpu', 'ram', 'disco', 'rede') NOT NULL,
    limite_atencao DECIMAL(5,2) NOT NULL,
    limite_critico DECIMAL(5,2) NOT NULL,
    UNIQUE KEY uq_limite_global_empresa_tipo (fk_empresa, tipo),
    CONSTRAINT fk_limite_global_empresa FOREIGN KEY (fk_empresa) REFERENCES empresa(id_empresa)
);

-- =====================================================
-- TABELA: planejamento_financeiro
-- FINALIDADE: Guarda as premissas financeiras e de capacidade de cada empresa.
-- RELACIONAMENTO: Cada empresa possui no maximo um planejamento.
-- =====================================================

CREATE TABLE planejamento_financeiro (
    id_planejamento INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    plano VARCHAR(60) NOT NULL,
    jogadores INT NOT NULL DEFAULT 0,
    ticket_medio DECIMAL(10,2) NOT NULL DEFAULT 0,
    orcamento_mensal DECIMAL(12,2) NOT NULL DEFAULT 0,
    meta_uso DECIMAL(5,2) NOT NULL DEFAULT 75,
    limite_subutilizado DECIMAL(5,2) NOT NULL DEFAULT 40,
    crescimento_mensal INT NOT NULL DEFAULT 0,
    meses_provisionamento INT NOT NULL DEFAULT 0,
    capacidade_por_servidor INT NOT NULL DEFAULT 0,
    capacidade_novo_servidor INT NOT NULL DEFAULT 0,
    custo_novo_servidor DECIMAL(10,2) NOT NULL DEFAULT 0,
    custo_implantacao DECIMAL(10,2) NOT NULL DEFAULT 0,
    economia_infra_propria DECIMAL(12,2) NOT NULL DEFAULT 0,
    dt_atualizacao DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_planejamento_empresa (fk_empresa),

    CONSTRAINT fk_planejamento_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);

-- =====================================================
-- TABELA: custo_infra_historico
-- FINALIDADE: Guarda o custo mensal da infraestrutura por empresa para o
-- historico do planejamento financeiro.
-- RELACIONAMENTO: Cada registro pertence a uma empresa.
-- =====================================================

CREATE TABLE custo_infra_historico (
    id_custo INT PRIMARY KEY AUTO_INCREMENT,
    fk_empresa INT NOT NULL,
    mes_referencia DATE NOT NULL,
    valor DECIMAL(12,2) NOT NULL,
    UNIQUE KEY uq_custo_empresa_mes (fk_empresa, mes_referencia),

    CONSTRAINT fk_custo_infra_empresa
        FOREIGN KEY (fk_empresa)
        REFERENCES empresa(id_empresa)
);

-- =====================================================
-- INSERCAO DE DADOS: endereco
-- FINALIDADE: Cadastra os enderecos das empresas.
-- =====================================================
INSERT INTO endereco (
    cep,
    logradouro,
    bairro,
    numero,
    complemento,
    estado,
    cidade
) VALUES
('01310100', 'Avenida Paulista', 'Bela Vista', '1578', 'Sala 12', 'SP', 'São Paulo'),
('02002000', 'Avenida Paulista', 'Bela Vista', '1500', 'Sala 42', 'SP', 'São Paulo'),
('03003000', 'Rua Augusta', 'Consolação', '500', 'Andar 3', 'SP', 'São Paulo'),
('50030230', 'Avenida Conde da Boa Vista', 'Boa Vista', '921', NULL, 'PE', 'Recife');


-- =====================================================
-- INSERCAO DE DADOS: empresa
-- FINALIDADE: Cadastra as empresas clientes da InfraTech.
-- =====================================================
INSERT INTO empresa (
    razao_social,
    nome_fantasia,
    cnpj,
    segmento_atuacao,
    email,
    telefone,
    status_sistema,
    fk_endereco
) VALUES
('InfraTech Games Ltda', 'InfraTech Games', '12345678000195', 'Desenvolvimento de Jogos', 'contato@infratech.com', '11999990001', 1, 1),
('GameCloud Servicos S.A.', 'GameCloud', '23456789000195', 'Hospedagem e Cloud', 'contato@gamecloud.com', '11999990002', 1, 2),
('TechPlay Tecnologia Ltda', 'TechPlay', '34567890000130', 'Sistemas e Softwares', 'contato@techplay.com', '11999990003', 1, 3),
('Arena Nordeste Servicos de Internet Ltda', 'Arena Nordeste', '60746948000112', 'Hospedagem e Cloud', 'contato@arenanordeste.com.br', '8140042020', 0, 4);


-- =====================================================
-- INSERCAO DE DADOS: funcionario
-- FINALIDADE: Cadastra os funcionarios e seus niveis
-- de acesso ao sistema.
-- =====================================================
INSERT INTO funcionario (
    fk_empresa,
    tipo_acesso,
    nome,
    dt_nascimento,
    email,
    senha,
    cpf,
    status_sistema
) VALUES
(1, 'ADMIN', 'Felipe Santos', '2007-04-12', 'felipe@infratech.com', '123456', '12345678901', 1),
(1, 'ADMIN', 'Manuella Arantes', '2007-01-15', 'manuella@infratech.com', '123456', '34567890123', 1),
(2, 'GESTOR', 'Alexandre Oliveira', '1997-06-03', 'alexandre@gamecloud.com', 'senha123', '28643895271', 1),
(2, 'ANALISTA_NOC', 'Bianca Souza', '1999-02-10', 'bianca@gamecloud.com', '123456', '11122233396', 1),
(2, 'ANALISTA_DADOS', 'Caio Lima', '1998-05-12', 'caio@gamecloud.com', '123456', '22233344495', 0),
(2, 'ANALISTA_NOC', NULL, NULL, 'diego.temp@gamecloud.com', 'trocar123', NULL, 1),
(3, 'GESTOR', 'Luana Pereira', '2003-03-18', 'luana@techplay.com', 'senhaLp1', '94784210876', 1),
(3, 'FUNCIONARIO', 'Rafael Nunes', '1995-09-01', 'rafael@techplay.com', '123456', '33344455516', 1),
(3, 'FUNCIONARIO', 'Debora Martins', '2000-12-20', 'debora@techplay.com', '123456', '44455566627', 1),
(3, 'FUNCIONARIO', 'Fernanda Melo', '1994-07-08', 'fernanda@techplay.com', '123456', '55566677738', 1),
(4, 'GESTOR', NULL, NULL, 'gestor@arenanordeste.com.br', 'trocarSenha1', NULL, 1),
(4, 'FUNCIONARIO', 'Igor Ramos', '1996-11-23', 'igor@arenanordeste.com.br', '123456', '66677788849', 1),
(4, 'FUNCIONARIO', 'Juliana Prado', '1993-04-17', 'juliana@arenanordeste.com.br', '123456', '77788899950', 0),
(4, 'FUNCIONARIO', 'Kaique Silva', '2001-01-30', 'kaique@arenanordeste.com.br', '123456', '88899900061', 1),
(2, 'ANALISTA_DADOS', 'Cláudia Martins', '1991-04-12', 'claudia.telemetria@infratech.demo', '123456', '90100000001', 1),
(2, 'ANALISTA_NOC', 'Júlio Almeida', '1994-08-23', 'julio.noc@infratech.demo', '123456', '90100000002', 1),
(2, 'GESTOR', 'Alberto Costa', '1985-11-06', 'alberto.gestor@infratech.demo', '123456', '90100000003', 1),
(1, 'ENGENHEIRO_QA', 'Morgana Pereira', '1990-01-20', 'morgana.qa@infratech.demo', '123456', '90100000004', 1),
(2, 'ENGENHEIRO_QA', 'Lucas Motta', '1992-01-20', 'lucas.qa@gamecloud.com', '123456', '90100000005', 1),
(3, 'ENGENHEIRO_QA', 'Silvio de Jesus', '1995-01-20', 'silvio@techplay.com', '123456', '90100000006', 1),
(4, 'ENGENHEIRO_QA', 'Pedro Silva', '1991-01-20', 'pedro@arenanordeste.com.br', '123456', '90100000007', 1);


-- =====================================================
-- INSERCAO DE DADOS: servidor
-- FINALIDADE: Cadastra os servidores e seus vinculos
-- com as empresas.
-- =====================================================
INSERT INTO servidor (
    nome,
    fk_empresa,
    status_sistema,
    localizacao,
    servidor_teste
) VALUES
('SRV-INFRA-01', 1, 1, "Salvador", 0),
('SRV-INFRA-02', 1, 1, "Salvador", 0),
('SRV-GAMECLOUD-01', 2, 1, "São Paulo", 0),
('SRV-GAMECLOUD-02', 2, 1, "São Paulo", 0),
('SRV-GAMECLOUD-LEGADO', 2, 0, "São Paulo", 0),
('SRV-TECHPLAY-01', 3, 1, "Boa vista", 0),
('SRV-TECHPLAY-02', 3, 1, "Boa vista", 0),
('SRV-ARENA-01', 4, 1, "Boa vista", 0),
('Servidor-B21X7M', 4, 1, "Boa vista", 0),
('SRV-GAMECLOUD-03', 2, 1, "São Paulo", 0),
('SRV-GAMECLOUD-04', 2, 1, "São Paulo", 1),
('SRV-GAMECLOUD-05', 2, 1, "São Paulo",1),
('SRV-GAMECLOUD-06', 2, 1, "São Paulo", 1);

-- =====================================================
-- INSERCAO DE DADOS: servidor_funcionario
-- FINALIDADE: Define os vinculos de acesso entre
-- funcionarios e servidores.
-- =====================================================
INSERT INTO servidor_funcionario (
    fk_funcionario,
    fk_servidor
) VALUES
(4, 3),
(9, 6);


-- =====================================================
-- INSERCAO DE DADOS: convite
-- FINALIDADE: Cadastra os codigos de convite e define
-- os limites de utilizacao de cada codigo.
-- =====================================================
INSERT INTO convite (
    codigo,
    tipo_acesso,
    quantidade_uso,
    quantidade_usada,
    fk_empresa
) VALUES
('B4E19F', 'FUNCIONARIO', 10, 4, 2),
('7C2AD0', 'FUNCIONARIO', 5, 5, 3),
('F0913B', 'FUNCIONARIO', 3, 0, 4);


-- =====================================================
-- INSERCAO DE DADOS: componente
-- FINALIDADE: Cadastra os componentes de hardware
-- existentes nos servidores monitorados.
-- =====================================================
INSERT INTO componente (
    tipo,
    capacidade_total,
    unidade_capacidade,
    status_monitoramento,
    fk_servidor
) VALUES
('cpu', 100.00, '%', 1, 3),
('ram', 128.00, 'GB', 1, 3),
('disco', 2000.00, 'GB', 1, 3),
('cpu', 100.00, '%', 1, 4),
('ram', 64.00, 'GB', 1, 4),
('cpu', 100.00, '%', 1, 6),
('rede', 10000.00, 'Mbps', 1, 3),
('cpu', 100.00, '%', 1, 9),
('ram', 128.00, 'GB', 1, 9),
('disco', 2000.00, 'GB', 1, 9),
('rede', 10000.00, 'Mbps', 1, 9),
('temperatura', 100.00, 'C', 1, 12),
('temperatura', 100.00, 'C', 1, 13);

-- =====================================================
-- INSERCAO DE DADOS: metrica
-- FINALIDADE: Configura as metricas monitoradas,
-- suas unidades e os limites de atencao e criticidade.
-- =====================================================
INSERT INTO metrica (
    fk_componente,
    nome,
    unidade,
    limite_atencao,
    limite_critico
) VALUES
(1, 'uso_percentual', '%', 75.00, 90.00),
(2, 'uso_percentual', '%', 75.00, 90.00),
(3, 'uso_percentual', '%', 75.00, 90.00),
(4, 'uso_percentual', '%', 80.00, 95.00),
(5, 'uso_percentual', '%', 80.00, 95.00),
(6, 'uso_percentual', '%', 70.00, 85.00),
(7, 'perda_pacotes', '%', 1.00, 5.00),
(7, 'latencia', 'ms', 50.00, 100.00),
(7, 'bytes_enviados_seg', 'B/s', NULL, NULL),
(7, 'bytes_recebidos_seg', 'B/s', NULL, NULL),
(8, 'uso_percentual', '%', 50.00, 90.00),
(9, 'uso_percentual', '%', 85.00, 90.00),
(10, 'uso_percentual', '%', 40.00, 90.00),
(11, 'bytes_enviados_seg', 'Mbps', 40.00, 75.00),
(12, 'temperatura_graus', 'c', 70.00, 90.00),
(13, 'temperatura_graus', 'c', 60.00, 85.00);


-- =====================================================
-- INSERCAO DE DADOS: custo mensal dos servidores
-- FINALIDADE: Define o custo de referencia da frota da GameCloud (empresa 2)
-- para alimentar a dashboard de planejamento financeiro.
-- =====================================================

UPDATE servidor SET custo_mensal = 3200.00 WHERE fk_empresa = 2 AND status_sistema = 1;
UPDATE servidor SET custo_mensal = 0.00 WHERE fk_empresa = 2 AND status_sistema = 0;


-- =====================================================
-- INSERCAO DE DADOS: planejamento_financeiro
-- FINALIDADE: Cadastra as premissas iniciais da GameCloud.
-- =====================================================

INSERT INTO planejamento_financeiro (
    fk_empresa,
    plano,
    jogadores,
    ticket_medio,
    orcamento_mensal,
    meta_uso,
    limite_subutilizado,
    crescimento_mensal,
    meses_provisionamento,
    capacidade_por_servidor,
    capacidade_novo_servidor,
    custo_novo_servidor,
    custo_implantacao,
    economia_infra_propria
) VALUES (
    2,
    'Profissional',
    10000,
    3.20,
    20000.00,
    75.00,
    40.00,
    375,
    2,
    2000,
    1250,
    3200.00,
    2000.00,
    8400.00
);


-- =====================================================
-- INSERCAO DE DADOS: custo_infra_historico
-- FINALIDADE: Cadastra o historico de custo mensal da GameCloud.
-- =====================================================

INSERT INTO custo_infra_historico (
    fk_empresa,
    mes_referencia,
    valor
) VALUES
(2, '2026-06-01', 12800.00),
(2, '2026-07-01', 12800.00),
(2, '2026-08-01', 16000.00),
(2, '2026-09-01', 16000.00),
(2, '2026-10-01', 19200.00),
(2, '2026-11-01', 19200.00);
