-- Atualiza a lista antiga de cargos, preservando os registros existentes.
ALTER TABLE funcionario MODIFY tipo_acesso
  ENUM('GESTOR', 'ADMIN', 'FUNCIONARIO', 'INFRATECH', 'ANALISTA_DADOS', 'ANALISTA_NOC')
  NOT NULL DEFAULT 'FUNCIONARIO';

-- Adiciona as três contas ao banco existente, sem apagar dados.
-- Senha de demonstração: 123456. Empresa: GameCloud.

INSERT INTO funcionario (fk_empresa, tipo_acesso, nome, data_nascimento, email, senha, cpf, status_sistema)
SELECT id_empresa, 'ANALISTA_DADOS', 'Cláudia Martins', '1991-04-12', 'claudia.telemetria@infratech.demo', '123456', '90100000001', 1
FROM empresa
WHERE email = 'contato@gamecloud.com'
  AND NOT EXISTS (SELECT 1 FROM funcionario WHERE email = 'claudia.telemetria@infratech.demo');

INSERT INTO funcionario (fk_empresa, tipo_acesso, nome, data_nascimento, email, senha, cpf, status_sistema)
SELECT id_empresa, 'ANALISTA_NOC', 'Júlio Almeida', '1994-08-23', 'julio.noc@infratech.demo', '123456', '90100000002', 1
FROM empresa
WHERE email = 'contato@gamecloud.com'
  AND NOT EXISTS (SELECT 1 FROM funcionario WHERE email = 'julio.noc@infratech.demo');

INSERT INTO funcionario (fk_empresa, tipo_acesso, nome, data_nascimento, email, senha, cpf, status_sistema)
SELECT id_empresa, 'GESTOR', 'Alberto Costa', '1985-11-06', 'alberto.gestor@infratech.demo', '123456', '90100000003', 1
FROM empresa
WHERE email = 'contato@gamecloud.com'
  AND NOT EXISTS (SELECT 1 FROM funcionario WHERE email = 'alberto.gestor@infratech.demo');

