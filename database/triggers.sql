
DROP TRIGGER IF EXISTS `menor_tutor_max_adicionales`;

DELIMITER $$

CREATE TRIGGER `menor_tutor_max_adicionales`
BEFORE INSERT ON `menor_tutor`
FOR EACH ROW
BEGIN
    DECLARE additional_tutor_count INT;

    IF NEW.`tipo_parentesco` = 'tutor_adicional' THEN
        SELECT COUNT(*)
        INTO additional_tutor_count
        FROM `menor_tutor`
        WHERE `menor_id` = NEW.`menor_id`
          AND `tipo_parentesco` = 'tutor_adicional';

        IF additional_tutor_count >= 4 THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'El menor no puede tener más de cuatro tutores adicionales';
        END IF;
    END IF;
END$$

DELIMITER ;
