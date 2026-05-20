class APEXError(Exception):
    pass


class ChEMBLError(APEXError):
    pass


class StructureFetchError(APEXError):
    pass


class QSARError(APEXError):
    pass


class DockingError(APEXError):
    pass
